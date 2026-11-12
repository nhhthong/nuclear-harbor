/**
 * Boolean walkability grid on the XZ plane with A* (8 neighbours, no corner cutting) and path
 * smoothing by grid line-of-sight. Pure: no three.js or physics (baking lives in bakeNav.ts).
 *
 * Search buffers are reused between calls; `findPath` allocates only the returned point array,
 * and is only called when a robot (re)plans, never per tick.
 */
export interface PathPoint {
  x: number;
  z: number;
}

export interface NavBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const SQRT2 = Math.SQRT2;
const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  /** 1 = walkable, 0 = blocked. */
  readonly walkable: Uint8Array;

  private readonly g: Float32Array;
  private readonly parent: Int32Array;
  private readonly visited: Uint32Array;
  private readonly closed: Uint32Array;
  private stamp = 0;
  private readonly heap: number[] = [];

  constructor(
    readonly bounds: NavBounds,
    readonly cellSize: number,
  ) {
    this.cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
    this.rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize));
    const n = this.cols * this.rows;
    this.walkable = new Uint8Array(n).fill(1);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.visited = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  // ---- cells -----------------------------------------------------------------------------

  colOf(x: number): number {
    return Math.floor((x - this.bounds.minX) / this.cellSize);
  }

  rowOf(z: number): number {
    return Math.floor((z - this.bounds.minZ) / this.cellSize);
  }

  centerX(col: number): number {
    return this.bounds.minX + (col + 0.5) * this.cellSize;
  }

  centerZ(row: number): number {
    return this.bounds.minZ + (row + 0.5) * this.cellSize;
  }

  inGrid(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  setBlocked(col: number, row: number, blocked = true): void {
    if (this.inGrid(col, row)) this.walkable[row * this.cols + col] = blocked ? 0 : 1;
  }

  /** Block every cell overlapping the XZ rectangle (used by tests and simple bakes). */
  blockRect(minX: number, minZ: number, maxX: number, maxZ: number): void {
    for (let r = this.rowOf(minZ); r <= this.rowOf(maxZ); r++) {
      for (let c = this.colOf(minX); c <= this.colOf(maxX); c++) this.setBlocked(c, r);
    }
  }

  isWalkableCell(col: number, row: number): boolean {
    return this.inGrid(col, row) && this.walkable[row * this.cols + col] === 1;
  }

  isWalkable(x: number, z: number): boolean {
    return this.isWalkableCell(this.colOf(x), this.rowOf(z));
  }

  get walkableCount(): number {
    let n = 0;
    for (let i = 0; i < this.walkable.length; i++) n += this.walkable[i] ?? 0;
    return n;
  }

  // ---- grid ray --------------------------------------------------------------------------

  /**
   * Walks the segment a -> b over the grid (sampled at a quarter cell). Returns the fraction of
   * the segment [0..1] travelled before the first blocked cell; 1 means the line is clear.
   */
  raycastGrid(ax: number, az: number, bx: number, bz: number): number {
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) return this.isWalkable(ax, az) ? 1 : 0;
    const steps = Math.max(1, Math.ceil(length / (this.cellSize * 0.25)));
    let pc = this.colOf(ax);
    let pr = this.rowOf(az);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = this.colOf(ax + dx * t);
      const r = this.rowOf(az + dz * t);
      let ok = this.isWalkableCell(c, r);
      // a diagonal step between cells must not squeeze past a blocked corner
      if (ok && c !== pc && r !== pr) ok = this.isWalkableCell(c, pr) && this.isWalkableCell(pc, r);
      if (!ok) return i === 0 ? 0 : (i - 1) / steps;
      pc = c;
      pr = r;
    }
    return 1;
  }

  lineWalkable(ax: number, az: number, bx: number, bz: number): boolean {
    return this.raycastGrid(ax, az, bx, bz) >= 1;
  }

  // ---- nearest walkable --------------------------------------------------------------------

  /** Centre of the closest walkable cell to (x, z) by expanding rings; null if the grid is blocked. */
  nearestWalkable(x: number, z: number, out: PathPoint): PathPoint | null {
    const c0 = Math.min(this.cols - 1, Math.max(0, this.colOf(x)));
    const r0 = Math.min(this.rows - 1, Math.max(0, this.rowOf(z)));
    if (this.isWalkableCell(c0, r0) && this.isWalkable(x, z)) {
      out.x = x;
      out.z = z;
      return out;
    }
    const maxRing = Math.max(this.cols, this.rows);
    for (let ring = 0; ring <= maxRing; ring++) {
      let best = Infinity;
      let bc = -1;
      let br = -1;
      for (let r = r0 - ring; r <= r0 + ring; r++) {
        for (let c = c0 - ring; c <= c0 + ring; c++) {
          if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== ring) continue;
          if (!this.isWalkableCell(c, r)) continue;
          const d = (this.centerX(c) - x) ** 2 + (this.centerZ(r) - z) ** 2;
          if (d < best) {
            best = d;
            bc = c;
            br = r;
          }
        }
      }
      if (bc >= 0) {
        out.x = this.centerX(bc);
        out.z = this.centerZ(br);
        return out;
      }
    }
    return null;
  }

  // ---- A* --------------------------------------------------------------------------------

  /**
   * Smoothed path from (sx, sz) to (gx, gz): waypoints excluding the start, ending at the goal
   * (snapped to the nearest walkable cell if needed). Null when no route exists.
   */
  findPath(sx: number, sz: number, gx: number, gz: number): PathPoint[] | null {
    const start: PathPoint = { x: 0, z: 0 };
    const goal: PathPoint = { x: 0, z: 0 };
    if (!this.nearestWalkable(sx, sz, start) || !this.nearestWalkable(gx, gz, goal)) return null;
    const sc = this.colOf(start.x);
    const sr = this.rowOf(start.z);
    const gc = this.colOf(goal.x);
    const gr = this.rowOf(goal.z);
    const goalIdx = gr * this.cols + gc;
    const startIdx = sr * this.cols + sc;

    if (startIdx === goalIdx || this.lineWalkable(sx, sz, goal.x, goal.z)) {
      return [{ x: goal.x, z: goal.z }];
    }

    this.stamp++;
    const stamp = this.stamp;
    const heap = this.heap;
    heap.length = 0;
    this.g[startIdx] = 0;
    this.parent[startIdx] = -1;
    this.visited[startIdx] = stamp;
    this.push(startIdx, this.heuristic(sc, sr, gc, gr));

    let found = false;
    while (heap.length > 0) {
      const current = this.pop();
      if (this.closed[current] === stamp) continue;
      this.closed[current] = stamp;
      if (current === goalIdx) {
        found = true;
        break;
      }
      const cc = current % this.cols;
      const cr = (current - cc) / this.cols;
      const gCurrent = this.g[current] ?? 0;
      for (const [dc, dr, cost] of NEIGHBOURS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!this.isWalkableCell(nc, nr)) continue;
        // no corner cutting: both orthogonal neighbours of a diagonal must be free
        if (dc !== 0 && dr !== 0 && (!this.isWalkableCell(cc + dc, cr) || !this.isWalkableCell(cc, cr + dr))) continue;
        const ni = nr * this.cols + nc;
        if (this.closed[ni] === stamp) continue;
        const ng = gCurrent + cost;
        if (this.visited[ni] !== stamp || ng < (this.g[ni] ?? Infinity)) {
          this.visited[ni] = stamp;
          this.g[ni] = ng;
          this.parent[ni] = current;
          this.push(ni, ng + this.heuristic(nc, nr, gc, gr));
        }
      }
    }
    if (!found) return null;

    const cells: number[] = [];
    for (let i = goalIdx; i !== -1; i = this.parent[i] ?? -1) cells.push(i);
    cells.reverse();
    return this.smooth(sx, sz, cells, goal);
  }

  private smooth(sx: number, sz: number, cells: number[], goal: PathPoint): PathPoint[] {
    const pts: PathPoint[] = cells.map((idx) => {
      const c = idx % this.cols;
      return { x: this.centerX(c), z: this.centerZ((idx - c) / this.cols) };
    });
    const last = pts[pts.length - 1];
    if (last) {
      last.x = goal.x;
      last.z = goal.z;
    }
    const out: PathPoint[] = [];
    let ax = sx;
    let az = sz;
    let i = 0;
    while (i < pts.length) {
      let far = i;
      for (let j = pts.length - 1; j > i; j--) {
        const p = pts[j];
        if (p && this.lineWalkable(ax, az, p.x, p.z)) {
          far = j;
          break;
        }
      }
      const p = pts[far];
      if (!p) break;
      out.push(p);
      ax = p.x;
      az = p.z;
      i = far + 1;
    }
    return out;
  }

  private heuristic(c: number, r: number, gc: number, gr: number): number {
    const dx = Math.abs(c - gc);
    const dz = Math.abs(r - gr);
    return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
  }

  // ---- binary heap (entries: idx, f) stored flat -----------------------------------------------

  private push(idx: number, f: number): void {
    const h = this.heap;
    let i = h.length / 2;
    h.push(idx, f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((h[p * 2 + 1] ?? 0) <= f) break;
      h[i * 2] = h[p * 2] ?? 0;
      h[i * 2 + 1] = h[p * 2 + 1] ?? 0;
      i = p;
    }
    h[i * 2] = idx;
    h[i * 2 + 1] = f;
  }

  private pop(): number {
    const h = this.heap;
    const top = h[0] ?? 0;
    const lastF = h.pop() ?? 0;
    const lastIdx = h.pop() ?? 0;
    const n = h.length / 2;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= n) break;
        if (c + 1 < n && (h[(c + 1) * 2 + 1] ?? 0) < (h[c * 2 + 1] ?? 0)) c++;
        if ((h[c * 2 + 1] ?? 0) >= lastF) break;
        h[i * 2] = h[c * 2] ?? 0;
        h[i * 2 + 1] = h[c * 2 + 1] ?? 0;
        i = c;
      }
      h[i * 2] = lastIdx;
      h[i * 2 + 1] = lastF;
    }
    return top;
  }
}
