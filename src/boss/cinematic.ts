import { BOSS_LOCAL } from './tunables';

export type CinematicStage = 'sky' | 'descent' | 'impact' | 'title' | 'release';

export interface CinematicFrame {
  t: number;
  stage: CinematicStage;
  /** Letterbox bar size 0..1 (1 = full bars). */
  bars: number;
  /** Title card opacity 0..1. */
  title: number;
  /** Boss height above ground as a fraction of the sky height (1 = sky, 0 = landed). */
  height: number;
  /** Fall speed as a fraction of the maximum (drives streaks and glow), 0 when not falling. */
  speed: number;
  /** Camera shake strength 0..1. */
  shake: number;
  /** 0..1: how far the camera has left the player (1 = on the cinematic shot). */
  leave: number;
  /** True from the impact time on. */
  impacted: boolean;
  /** Seconds since the impact (0 before). */
  sinceImpact: number;
}

const smooth = (x: number): number => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/** Pure cinematic timeline (ticket T-22): sky shot, accelerating descent, impact, title, release. */
export function cinematicFrame(t: number, out: CinematicFrame): CinematicFrame {
  const c = BOSS_LOCAL.cinematic;
  const tt = Math.max(0, Math.min(c.duration, t));
  const fall = Math.min(1, Math.max(0, (tt - c.descentStart) / (c.impactAt - c.descentStart)));
  out.t = tt;
  out.height = 1 - fall * fall;
  out.speed = tt >= c.impactAt || tt < c.descentStart ? 0 : fall;
  out.impacted = tt >= c.impactAt;
  out.sinceImpact = Math.max(0, tt - c.impactAt);
  out.shake = out.impacted ? Math.exp(-out.sinceImpact * 1.5) : out.speed * 0.12;
  out.bars = Math.min(smooth(tt / 0.6), smooth((c.duration - tt) / 0.5));
  const titleIn = smooth((tt - (c.impactAt + 0.3)) / 0.5);
  const titleOut = smooth((c.duration - 0.2 - tt) / 0.5);
  out.title = Math.min(titleIn, titleOut);
  out.leave = Math.min(smooth(tt / 1.1), smooth((c.duration - tt) / 0.6));
  if (tt >= c.duration - 0.2) out.stage = 'release';
  else if (tt >= c.impactAt + 0.3) out.stage = 'title';
  else if (tt >= c.impactAt) out.stage = 'impact';
  else if (tt >= c.descentStart) out.stage = 'descent';
  else out.stage = 'sky';
  return out;
}

export function newCinematicFrame(): CinematicFrame {
  return { t: 0, stage: 'sky', bars: 0, title: 0, height: 1, speed: 0, shake: 0, leave: 0, impacted: false, sinceImpact: 0 };
}

/** E skip is allowed only after `skipAfter` seconds. */
export function canSkip(t: number): boolean {
  return t >= BOSS_LOCAL.cinematic.skipAfter;
}
