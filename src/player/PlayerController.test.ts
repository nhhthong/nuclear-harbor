import { PerspectiveCamera, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER, SIM } from '@/config/tunables';
import { EventBus } from '@/core/EventBus';
import type { GameEvents } from '@/core/events';
import { InputManager } from '@/core/InputManager';
import { PlayerState } from '@/core/PlayerState';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { PlayerController } from './PlayerController';

const DT = 1 / 60;

interface Rig {
  physics: PhysicsWorld;
  player: PlayerState;
  input: InputManager;
  events: EventBus<GameEvents>;
  camera: PerspectiveCamera;
  controller: PlayerController;
  landed: number[];
  footsteps: boolean[];
  tick(n: number): void;
}

const rigs: Rig[] = [];

async function makeRig(options: { ground?: boolean; start?: [number, number, number] } = {}): Promise<Rig> {
  const physics = await PhysicsWorld.create();
  if (options.ground !== false) {
    physics.addStaticBox({ center: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: 200, y: 0.5, z: 200 } });
  }
  // wall at z = -20 (face at -19.5), step 0.3 m high at x 10..14, z -4..0 (walk +X into it)
  physics.addStaticBox({ center: { x: 0, y: 2, z: -20 }, halfExtents: { x: 20, y: 2, z: 0.5 } });
  physics.addStaticBox({ center: { x: 12, y: 0.15, z: -2 }, halfExtents: { x: 2, y: 0.15, z: 2 } });
  const events = new EventBus<GameEvents>();
  const player = new PlayerState(events);
  const s = options.start ?? [0, 0, 0];
  player.position.set(s[0], s[1], s[2]);
  const input = new InputManager(events);
  const camera = new PerspectiveCamera();
  const landed: number[] = [];
  const footsteps: boolean[] = [];
  events.on('player:landed', (e) => landed.push(e.impactSpeed));
  events.on('player:footstep', (e) => footsteps.push(e.sprinting));
  const controller = new PlayerController({ physics, player, input, events, camera, getSensitivity: () => 1 });
  const rig: Rig = {
    physics,
    player,
    input,
    events,
    camera,
    controller,
    landed,
    footsteps,
    tick(n) {
      for (let i = 0; i < n; i++) {
        controller.fixedUpdate(DT);
        physics.step(DT);
      }
    },
  };
  rigs.push(rig);
  return rig;
}

afterEach(() => {
  while (rigs.length) {
    const r = rigs.pop()!;
    r.controller.dispose();
    r.physics.dispose();
  }
});

const hSpeed = (p: PlayerState) => Math.hypot(p.velocity.x, p.velocity.z);

describe('PlayerController', () => {
  it('AC1: walks at 5 m/s, sprints at 7.5 m/s, diagonals are not faster', async () => {
    const r = await makeRig();
    r.tick(30);
    r.input.handleCode('KeyW', true);
    r.tick(30);
    expect(hSpeed(r.player)).toBeGreaterThan(5 * 0.97);
    expect(hSpeed(r.player)).toBeLessThan(5 * 1.03);
    expect(r.player.grounded).toBe(true);
    expect(r.player.sprinting).toBe(false);

    r.input.handleCode('ShiftLeft', true);
    r.tick(30);
    expect(r.player.sprinting).toBe(true);
    expect(hSpeed(r.player)).toBeGreaterThan(7.5 * 0.97);
    expect(hSpeed(r.player)).toBeLessThan(7.5 * 1.03);

    r.input.handleCode('ShiftLeft', false);
    r.input.handleCode('KeyD', true);
    r.tick(30);
    expect(hSpeed(r.player)).toBeLessThan(5 * 1.03);
    expect(hSpeed(r.player)).toBeGreaterThan(5 * 0.97);
  });

  it('sprint requires moving forward', async () => {
    const r = await makeRig();
    r.tick(10);
    r.input.handleCode('ShiftLeft', true);
    r.input.handleCode('KeyS', true);
    r.tick(10);
    expect(r.player.sprinting).toBe(false);
  });

  it('AC2: is blocked by the wall and reports zero speed', async () => {
    const r = await makeRig();
    r.input.handleCode('KeyW', true);
    r.tick(60 * 5);
    expect(r.player.position.z).toBeGreaterThan(-19.5);
    expect(r.player.position.z).toBeLessThan(-19.5 + PLAYER.capsuleRadius + 0.1);
    expect(hSpeed(r.player)).toBeLessThan(0.1);
  });

  it('AC2: steps up a 0.3 m step with forward input only', async () => {
    const r = await makeRig({ start: [8, 0, -2] });
    r.player.yaw = -Math.PI / 2; // face +X
    r.input.handleCode('KeyW', true);
    r.tick(60);
    expect(r.player.position.x).toBeGreaterThan(11);
    expect(r.player.position.y).toBeGreaterThan(0.25);
    expect(r.player.position.y).toBeLessThan(0.4);
  });

  it('AC3: falls with gravity, emits player:landed, and rests on the ground', async () => {
    const r = await makeRig({ start: [0, 5, 0] });
    r.tick(30);
    expect(r.player.grounded).toBe(false);
    // after 0.5 s: v = g t
    expect(r.player.velocity.y).toBeCloseTo(SIM.gravity * 0.5, 0);
    r.tick(60);
    expect(r.player.grounded).toBe(true);
    expect(r.landed).toHaveLength(1);
    expect(r.landed[0]).toBeGreaterThan(10);
    expect(r.player.position.y).toBeLessThan(0.1);
  });

  it('AC3: falling below the kill plane kills the player (environment)', async () => {
    const r = await makeRig({ ground: false, start: [0, 2, 0] });
    const sources: string[] = [];
    r.events.on('player:died', (e) => sources.push(e.source));
    r.player.invulnerableFor = 5;
    r.tick(120);
    expect(r.player.position.y).toBeLessThan(PLAYER.killPlaneY);
    expect(r.player.alive).toBe(false);
    expect(sources).toEqual(['environment']);
  });

  it('AC4: mouse look clamps pitch; camera follows interpolated position', async () => {
    const r = await makeRig();
    r.tick(5);
    const look = r.input as unknown as { lookX: number; lookY: number };
    look.lookY = -100000;
    r.controller.update(DT, 1);
    expect(r.player.pitch).toBeCloseTo((PLAYER.maxPitchDeg * Math.PI) / 180);
    look.lookX = 100;
    r.controller.update(DT, 1);
    expect(r.player.yaw).toBeCloseTo(-100 * PLAYER.lookRadPerPixel);

    r.input.handleCode('KeyW', true);
    r.tick(10);
    const z1 = r.player.position.z;
    r.tick(1);
    const z2 = r.player.position.z;
    r.controller.update(DT, 0.5);
    expect(r.camera.position.z).toBeCloseTo((z1 + z2) / 2, 5);
    expect(r.camera.position.y).toBeCloseTo(r.player.position.y + PLAYER.eyeHeight, 2);
    expect(r.camera.rotation.order).toBe('YXZ');
  });

  it('AC5: externalVelocity overrides input and gravity but is blocked by geometry', async () => {
    const r = await makeRig({ start: [0, 3, 0] });
    r.player.externalVelocity = new Vector3(0, 0, -10);
    r.input.handleCode('KeyD', true);
    r.tick(30);
    expect(r.player.position.y).toBeCloseTo(3, 1);
    expect(r.player.position.x).toBeCloseTo(0, 3);
    expect(r.player.position.z).toBeCloseTo(-5, 1);
    expect(r.player.velocity.z).toBeCloseTo(-10, 1);

    r.tick(90);
    expect(r.player.position.z).toBeGreaterThan(-19.5);
    expect(r.player.position.z).toBeLessThan(-19.5 + PLAYER.capsuleRadius + 0.1);
    expect(Math.abs(r.player.velocity.z)).toBeLessThan(0.5);

    r.player.externalVelocity = null;
    r.tick(60);
    expect(r.player.position.y).toBeLessThan(0.1); // gravity resumed
    expect(r.player.position.x).toBeGreaterThan(1); // input resumed
  });

  it('AC6: impulse knocks back and decays; teleport moves the capsule next tick', async () => {
    const r = await makeRig();
    r.tick(10);
    r.player.addImpulse(new Vector3(0, 0, 12));
    r.tick(1);
    expect(r.player.velocity.z).toBeGreaterThan(8);
    r.tick(60);
    expect(Math.abs(r.player.velocity.z)).toBeLessThan(0.01);
    expect(r.player.position.z).toBeGreaterThan(0.5);

    r.player.teleport({ x: 30, y: 0, z: 30 });
    expect(r.player.teleportPending).toBe(true);
    r.tick(1);
    expect(r.player.teleportPending).toBe(false);
    expect(r.player.position.x).toBeCloseTo(30, 1);
    expect(r.player.position.z).toBeCloseTo(30, 1);
  });

  it('AC7: Space does not move the player vertically', async () => {
    const r = await makeRig();
    r.tick(10);
    r.input.handleCode('Space', true);
    r.tick(30);
    expect(r.player.position.y).toBeLessThan(0.1);
    expect(r.player.velocity.y).toBeCloseTo(0);
  });

  it('AC8: no movement or look while controls are locked or the player is dead', async () => {
    const r = await makeRig();
    r.tick(10);
    r.input.handleCode('KeyW', true);
    r.player.controlsLocked = true;
    r.tick(30);
    const look = r.input as unknown as { lookX: number; lookY: number };
    look.lookX = 50;
    r.controller.update(DT, 1);
    expect(r.player.yaw).toBe(0);
    expect(r.player.position.z).toBeCloseTo(0, 2);

    r.player.controlsLocked = false;
    r.player.hp = 0;
    r.tick(30);
    look.lookX = 50;
    r.controller.update(DT, 1);
    expect(r.player.yaw).toBe(0);
    expect(r.player.position.z).toBeCloseTo(0, 2);
  });

  it('emits footsteps by distance and counts down invulnerability', async () => {
    const r = await makeRig();
    r.tick(20);
    r.player.invulnerableFor = 0.5;
    r.input.handleCode('KeyW', true);
    r.tick(60); // ~4.5 m walked after ramp-up => 2 steps
    expect(r.footsteps.length).toBeGreaterThanOrEqual(1);
    expect(r.footsteps.every((s) => !s)).toBe(true);
    expect(r.player.invulnerableFor).toBe(0);
  });
});
