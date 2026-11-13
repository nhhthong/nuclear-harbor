import {
  AdditiveBlending,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  BoxGeometry,
  MeshBasicMaterial,
} from 'three';

type TowerVisualState = 'inactive' | 'activating' | 'active';

const TOWER_HEIGHT = 3;
const TOWER_BEAM_HEIGHT = 40;

export interface TowerModel {
  group: Group;
  /** Apply a visual state; `pulse` (seconds) drives the activating blink. */
  setState(state: TowerVisualState, pulse: number): void;
}

const COLORS = {
  inactive: 0xff3b20,
  amber: 0xffaa22,
  active: 0x22ff66,
} as const;

/** Procedural tower: hex pillar, console, emissive ring, thin light beam (GDD 8.1). */
export function createTowerModel(): TowerModel {
  const group = new Group();
  const bodyMat = new MeshStandardMaterial({ color: 0x4a525c, roughness: 0.7, metalness: 0.5 });
  const glowMat = new MeshStandardMaterial({
    color: 0x222222,
    emissive: COLORS.inactive,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const beamMat = new MeshBasicMaterial({
    color: COLORS.inactive,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const base = new Mesh(new CylinderGeometry(0.85, 1.0, 0.3, 6), bodyMat);
  base.position.y = 0.15;
  const pillar = new Mesh(new CylinderGeometry(0.5, 0.65, TOWER_HEIGHT, 6), bodyMat);
  pillar.position.y = TOWER_HEIGHT / 2;
  const console_ = new Mesh(new BoxGeometry(0.9, 0.5, 0.5), bodyMat);
  console_.position.set(0, 1.2, 0.6);
  console_.rotation.x = -0.4;
  const screen = new Mesh(new BoxGeometry(0.7, 0.05, 0.35), glowMat);
  screen.position.set(0, 1.2 + 0.2, 0.62);
  screen.rotation.x = -0.4;
  const ring = new Mesh(new TorusGeometry(0.75, 0.07, 8, 24), glowMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = TOWER_HEIGHT - 0.3;
  const beam = new Mesh(new CylinderGeometry(0.08, 0.08, TOWER_BEAM_HEIGHT, 8, 1, true), beamMat);
  beam.position.y = TOWER_HEIGHT + TOWER_BEAM_HEIGHT / 2;

  group.add(base, pillar, console_, screen, ring, beam);

  return {
    group,
    setState(state, pulse) {
      let color: number = COLORS.inactive;
      let intensity = 1.6;
      if (state === 'activating') {
        const k = 0.5 + 0.5 * Math.sin(pulse * 14);
        color = COLORS.amber;
        intensity = 1 + 2.5 * k;
      } else if (state === 'active') {
        color = COLORS.active;
        intensity = 2.5;
      }
      glowMat.emissive.setHex(color);
      glowMat.emissiveIntensity = intensity;
      beamMat.color.setHex(color);
      beamMat.opacity = state === 'active' ? 0.5 : 0.35;
    },
  };
}
