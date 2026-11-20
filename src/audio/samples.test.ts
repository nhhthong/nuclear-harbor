import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { SOUND_IDS } from './catalogue';
import { EVENT_ROUTES, reloadParts } from './eventMap';
import { SampleBank } from './sampleBank';
import { AUDIO_BYTES_BUDGET, LOOPS, pickSample, SAMPLE_MANIFEST, sampleFiles, seededRng, type SampleDef } from './samples';
import { SOUNDS } from './sounds';
import { AUDIO } from './tunables';

const AUDIO_DIR = path.resolve(__dirname, '../../public/assets/audio');

describe('sample manifest (spec 32)', () => {
  it('points only to OGG files that exist in public/assets/audio', () => {
    const files = sampleFiles();
    expect(files.length).toBeGreaterThan(30);
    for (const f of files) {
      expect(f.endsWith('.ogg')).toBe(true);
      expect(existsSync(path.join(AUDIO_DIR, f)), f).toBe(true);
    }
  });

  it('ships no orphan audio file', () => {
    const used = new Set(sampleFiles());
    for (const f of readdirSync(AUDIO_DIR)) expect(used.has(f), f).toBe(true);
  });

  it('keeps the shipped audio under the byte budget', () => {
    const total = readdirSync(AUDIO_DIR).reduce((n, f) => n + statSync(path.join(AUDIO_DIR, f)).size, 0);
    expect(total).toBeLessThan(AUDIO_BYTES_BUDGET);
  });

  it('only maps catalogue ids, each with a procedural fallback recipe', () => {
    for (const id of Object.keys(SAMPLE_MANIFEST)) {
      expect(SOUND_IDS).toContain(id);
      expect(typeof SOUNDS[id as keyof typeof SOUNDS]).toBe('function');
    }
    // the low-health loop falls back to the procedural heartbeat beat
    expect(typeof SOUNDS.heartbeat).toBe('function');
  });

  it('has sane gains and jitters', () => {
    for (const def of Object.values(SAMPLE_MANIFEST)) {
      expect(def!.files.length).toBeGreaterThan(0);
      expect(def!.gain).toBeGreaterThan(0);
      expect(def!.gain).toBeLessThanOrEqual(1.5);
      expect(def!.pitchJitter).toBeGreaterThanOrEqual(0);
      expect(def!.pitchJitter).toBeLessThan(0.15);
    }
    for (const l of Object.values(LOOPS)) expect(l.gain).toBeGreaterThan(0);
  });
});

describe('pickSample', () => {
  const def: SampleDef = { files: ['a.ogg', 'b.ogg', 'c.ogg'], gain: 0.5, pitchJitter: 0.05, gainJitter: 0.1 };

  it('is deterministic with a seeded rng', () => {
    const a = Array.from({ length: 20 }, ((r) => () => pickSample(def, r))(seededRng(7)));
    const b = Array.from({ length: 20 }, ((r) => () => pickSample(def, r))(seededRng(7)));
    expect(a).toEqual(b);
  });

  it('keeps pitch and gain inside the jitter range and uses every variant', () => {
    const rng = seededRng(42);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const p = pickSample(def, rng, 2)!;
      seen.add(p.file);
      expect(p.rate).toBeGreaterThanOrEqual(0.95);
      expect(p.rate).toBeLessThanOrEqual(1.05);
      expect(p.gain).toBeGreaterThanOrEqual(0.5 * 2 * 0.9);
      expect(p.gain).toBeLessThanOrEqual(0.5 * 2 * 1.1);
    }
    expect(seen.size).toBe(3);
  });

  it('never repeats the previous variant when there is a choice', () => {
    const rng = seededRng(3);
    let last: string | undefined;
    for (let i = 0; i < 100; i++) {
      const p = pickSample(def, rng, 1, last)!;
      expect(p.file).not.toBe(last);
      last = p.file;
    }
  });

  it('returns null when no variant is decoded (caller plays the recipe)', () => {
    expect(pickSample(def, seededRng(1), 1, undefined, () => false)).toBeNull();
    expect(pickSample(def, seededRng(1), 1, undefined, (f) => f === 'b.ogg')!.file).toBe('b.ogg');
  });
});

describe('SampleBank', () => {
  const fakeCtx = (fail = false) =>
    ({
      decodeAudioData: (data: ArrayBuffer) => (fail ? Promise.reject(new Error('bad')) : Promise.resolve({ duration: data.byteLength } as unknown as AudioBuffer)),
    }) as unknown as BaseAudioContext;
  const okFetch = ((url: string) =>
    Promise.resolve({ ok: !url.includes('missing'), status: url.includes('missing') ? 404 : 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) })) as unknown as typeof fetch;
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('loads same-origin relative URLs and marks missing files failed', async () => {
    const urls: string[] = [];
    const spy = ((u: string, i?: RequestInit) => {
      urls.push(u);
      return okFetch(u, i);
    }) as typeof fetch;
    const bank = new SampleBank(fakeCtx(), ['a.ogg', 'missing.ogg'], 'assets/audio/', spy);
    expect(bank.statusOf('a.ogg')).toBe('loading');
    expect(bank.get('a.ogg')).toBeNull();
    await flush();
    await flush();
    expect(urls).toEqual(['assets/audio/a.ogg', 'assets/audio/missing.ogg']);
    expect(bank.isReady('a.ogg')).toBe(true);
    expect(bank.statusOf('missing.ogg')).toBe('failed');
    expect(bank.summary()).toEqual({ loading: 0, ready: 1, failed: 1 });
    bank.dispose();
    expect(bank.get('a.ogg')).toBeNull();
  });

  it('marks undecodable files failed and notifies ready files', async () => {
    const ready: string[] = [];
    const bad = new SampleBank(fakeCtx(true), ['x.ogg'], 'assets/audio/', okFetch);
    const good = new SampleBank(fakeCtx(), ['y.ogg'], 'assets/audio/', okFetch);
    good.onReady((f) => ready.push(f));
    await flush();
    await flush();
    expect(bad.statusOf('x.ogg')).toBe('failed');
    expect(ready).toEqual(['y.ogg']);
  });

  it('fails cleanly without fetch', () => {
    const bank = new SampleBank(fakeCtx(), ['a.ogg'], 'assets/audio/', null);
    expect(bank.statusOf('a.ogg')).toBe('failed');
  });
});

describe('spec 32 routes', () => {
  const v = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);

  it('splits the reload into three parts inside the reload duration', () => {
    for (const d of [1.2, 1.8, 2.5]) {
      const parts = reloadParts(d);
      expect(parts.map((p) => p.id)).toEqual(['reloadMagOut', 'reloadMagIn', 'reloadBolt']);
      const delays = parts.map((p) => p.delay!);
      expect(delays[0]).toBeCloseTo(AUDIO.reload.magOutAt);
      expect(delays[1]!).toBeGreaterThan(delays[0]!);
      expect(delays[2]!).toBeGreaterThan(delays[1]!);
      expect(delays[2]!).toBeLessThan(d);
    }
  });

  it('adds a delayed shell casing to every shot', () => {
    const out = EVENT_ROUTES['weapon:fired']();
    expect(out).toEqual([{ id: 'rifleShot' }, { id: 'shellCasing', delay: AUDIO.casingDelay }]);
  });

  it('picks the footstep surface from the player position', () => {
    expect(EVENT_ROUTES['player:footstep']({ sprinting: false }, { player: v(-10, 0, 20) })).toMatchObject({ id: 'footstepWalk' });
    expect(EVENT_ROUTES['player:footstep']({ sprinting: true }, { player: v(-10, 0, 20) })).toMatchObject({ id: 'footstepSprint' });
    expect(EVENT_ROUTES['player:footstep']({ sprinting: false }, { player: v(20, 3.6, -20) })).toMatchObject({ id: 'footstepMetal' });
  });

  it('picks the impact material from the ray hit', () => {
    expect(EVENT_ROUTES['combat:impact']({ point: v(0, 0, 0), normal: v(0, 1, 0) })).toMatchObject({ id: 'impactConcrete' });
    expect(EVENT_ROUTES['combat:impact']({ point: v(0, 1.5, 0), normal: v(1, 0, 0) })).toMatchObject({ id: 'impactMetal' });
  });

  it('routes gates, drones, melee robots, samurai and the scorpion telegraph', () => {
    expect(EVENT_ROUTES['world:gateMoved']({ id: 'g', position: v(), open: true })).toMatchObject({ id: 'gate' });
    const drone = EVENT_ROUTES['enemy:alerted']({ id: 'd', type: 'drone', position: v() }) as Array<{ id: string }>;
    expect(drone.map((r) => r.id)).toEqual(['enemyAlert', 'droneBuzz']);
    expect(EVENT_ROUTES['enemy:attacked']({ id: 's', type: 'spot', position: v() })).toMatchObject({ id: 'enemyMelee' });
    expect(EVENT_ROUTES['enemy:attacked']({ id: 's', type: 'samurai', position: v() })).toMatchObject({ id: 'swordSwing' });
    expect(EVENT_ROUTES['enemy:attacked']({ id: 's', type: 'army', position: v() })).toMatchObject({ id: 'enemyShot' });
    expect(EVENT_ROUTES['scorpion:telegraph']({ id: 'x', skill: 'ram', position: v(), radius: 3, duration: 1 })).toMatchObject({ id: 'steamHiss' });
  });
});
