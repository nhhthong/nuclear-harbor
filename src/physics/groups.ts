/**
 * Rapier interaction groups: upper 16 bits = membership, lower 16 bits = filter. Two colliders
 * interact when each one's membership intersects the other's filter.
 */
const Layer = {
  /** Static level geometry (ground, containers, buildings, cranes). */
  WORLD: 1 << 0,
  PLAYER: 1 << 1,
  /** Robot and boss hit volumes. */
  ENEMY: 1 << 2,
  /** Extra membership bit carried by grappleable static colliders (GDD 4.1). */
  GRAPPLE: 1 << 3,
  /** Non-solid volumes (pickups, triggers). */
  SENSOR: 1 << 4,
  /** Dynamic debris / props. */
  PROP: 1 << 5,
} as const;

const ALL_LAYERS = 0xffff;

function interactionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

/** Collider group presets. */
export const Groups = {
  world: interactionGroups(Layer.WORLD, ALL_LAYERS),
  worldGrappleable: interactionGroups(Layer.WORLD | Layer.GRAPPLE, ALL_LAYERS),
  player: interactionGroups(Layer.PLAYER, Layer.WORLD | Layer.ENEMY | Layer.SENSOR | Layer.PROP),
  enemy: interactionGroups(Layer.ENEMY, Layer.WORLD | Layer.PLAYER | Layer.ENEMY | Layer.PROP),
  sensor: interactionGroups(Layer.SENSOR, Layer.PLAYER),
  prop: interactionGroups(Layer.PROP, Layer.WORLD | Layer.PLAYER | Layer.ENEMY | Layer.PROP),
} as const;

/**
 * Query filter presets (who a ray / shape-cast "is", and what it can hit). The membership half is
 * set to all layers so the target's own filter never rejects the query.
 */
export const QueryGroups = {
  /** Player bullets: world + enemies. */
  playerShot: interactionGroups(ALL_LAYERS, Layer.WORLD | Layer.ENEMY | Layer.PROP),
  /** Enemy bullets / line of sight to the player: world + player. */
  enemyShot: interactionGroups(ALL_LAYERS, Layer.WORLD | Layer.PLAYER),
  /** Line of sight / navigation probes: static world only. */
  worldOnly: interactionGroups(ALL_LAYERS, Layer.WORLD),
  /** Grapple ray: all static world (so walls occlude); validity = hit collider meta.grappleable. */
  grapple: interactionGroups(ALL_LAYERS, Layer.WORLD),
  /** Player character controller movement. */
  playerMove: interactionGroups(Layer.PLAYER, Layer.WORLD | Layer.ENEMY | Layer.PROP),
  /** Enemy character movement. */
  enemyMove: interactionGroups(Layer.ENEMY, Layer.WORLD | Layer.PROP),
} as const;
