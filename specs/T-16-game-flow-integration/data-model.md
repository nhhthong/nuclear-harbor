# Data model: T-16

- **RunStatus**: `running | died | expired | won`. Transitions: running -> died | expired | won; died -> running (respawn); expired and won are terminal. Any event arriving in a terminal state is ignored.
- **Checkpoint**: `{ id, x, y, z, yaw }`, default `{ id: 'spawn', ...spawnFor(sandbox) }`.
- **RunStats**: `{ elapsed, kills, shots, hits, deaths, respawns }`; accuracy = hits / shots (0 when no shots).
- **BestResult**: `{ completed: boolean, bestTimeRemaining: number }`; `mergeBest(old, timeRemaining)` keeps the larger time.
- **Decision** (returned by pure functions): `{ status, gameOver?: reason, victoryDelay?: boolean }`.
- **EnemySpawn** (existing type): `{ type, position, patrol[] }`; authored sets per zone.
- **PickupCandidate** (existing type): `{ kind, zone, x, z, elevated?, castFromY? }`.

## Contracts

- Events out: `game:over {reason}`, `game:victory {timeRemaining}`, `game:respawn {checkpointId, position}`.
- Events in: `player:died`, `countdown:expired`, `countdown:tick`, `countdown:stopped`, `boss:defeated`, `game:checkpoint`, `game:requestRespawn`, `game:requestRestart`, `combat:hit`, `weapon:fired`, `enemy:destroyed`.
- Test hook: `ctx.testHooks.flow = { getCheckpoint(), respawn(), stats(), getStatus(), getBest() }`.
