import { describe, expect, it } from 'vitest';
import { EventBus } from './EventBus';
import type { GameEvents } from './events';
import { DEFAULT_BINDINGS } from './InputManager';
import { migrateBindings, Settings } from './Settings';

describe('migrateBindings', () => {
  it('removes right mouse from reload in saves that predate the aim action', () => {
    const merged = migrateBindings(DEFAULT_BINDINGS, { reload: ['Mouse2', 'KeyR'] });
    expect(merged.reload).toEqual(['KeyR']);
    expect(merged.aim).toEqual(['Mouse2']);
  });
  it('falls back to the default when nothing is left', () => {
    expect(migrateBindings(DEFAULT_BINDINGS, { reload: ['Mouse2'] }).reload).toEqual(['KeyR']);
  });
  it('keeps deliberate choices once aim exists in the save', () => {
    const merged = migrateBindings(DEFAULT_BINDINGS, { reload: ['KeyT'], aim: ['Mouse1'] });
    expect(merged.reload).toEqual(['KeyT']);
    expect(merged.aim).toEqual(['Mouse1']);
  });
});

describe('Settings.autoReload', () => {
  it('defaults to on and persists', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = new Settings(new EventBus<GameEvents>(), store);
    expect(s.get('autoReload')).toBe(true);
    s.set('autoReload', false);
    expect(new Settings(new EventBus<GameEvents>(), store).get('autoReload')).toBe(false);
  });
});
