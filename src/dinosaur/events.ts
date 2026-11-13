import type { Vector3 } from 'three';

export type DinoSkill = 'ram' | 'leapStomp' | 'tailSpin';

declare module '@/core/events' {
  interface GameEvents {
    'dino:spawned': { id: string; towerId: number; position: Vector3 };
    /** Roar with camera shake request (the dinosaur module applies the shake itself). */
    'dino:roar': { id: string; position: Vector3; shake: number; duration: number };
    'dino:telegraph': { id: string; skill: DinoSkill; position: Vector3; radius: number; duration: number };
    'dino:attack': { id: string; skill: DinoSkill; position: Vector3; radius: number };
    'dino:hitPlayer': { id: string; skill: DinoSkill; damage: number };
    'dino:stunned': { id: string; position: Vector3; duration: number };
    'dino:defeated': { id: string; position: Vector3 };
  }
}
