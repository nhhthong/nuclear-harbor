import type { Vector3 } from 'three';

export type ScorpionSkill = 'ram' | 'venom' | 'tailSlam';

declare module '@/core/events' {
  interface GameEvents {
    'scorpion:spawned': { id: string; towerId: number; position: Vector3 };
    /** Threat display with a camera shake request (the scorpion module applies the shake itself). */
    'scorpion:roar': { id: string; position: Vector3; shake: number; duration: number };
    'scorpion:telegraph': { id: string; skill: ScorpionSkill; position: Vector3; radius: number; duration: number };
    'scorpion:attack': { id: string; skill: ScorpionSkill; position: Vector3; radius: number };
    'scorpion:hitPlayer': { id: string; skill: ScorpionSkill; damage: number };
    'scorpion:stunned': { id: string; position: Vector3; duration: number };
    'scorpion:defeated': { id: string; position: Vector3 };
  }
}
