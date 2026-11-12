# Contract: spider module

- `export const createSpiderRobot: EnemyFactory` in `src/enemies/spider/index.ts` (unchanged signature).
- Returns a `BaseEnemy` subclass, `type: 'spider'`, `maxHp` 150, `state` in `patrol|flank|chase|attack|hop|destroyed`.
- Events via base: `enemy:alerted` (on first detection), `enemy:attacked` (per bolt), `enemy:damaged`, `enemy:destroyed`.
- Hit volumes: body (`body`), sensor dome (`critical`).
- Pure exports for tests: `decideSpider`, `computeFlankPoint`, `canHop`, `hopPosition`, gait helpers.
