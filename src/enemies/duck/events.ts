import type { Vector3 } from 'three';

declare module '@/core/events' {
  interface GameEvents {
    /** Fuse beep: `count` is 3, 2, 1. */
    'duck:beep': { id: string; position: Vector3; count: number };
    /** Detonation resolved (hitPlayer false = harmless pop). */
    'duck:explode': { id: string; position: Vector3; radius: number; hitPlayer: boolean };
  }
}

export {};
