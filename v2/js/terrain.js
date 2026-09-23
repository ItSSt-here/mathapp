// ---------- Terrain: raised plateaus, walkability, and pathfinding ----------
// The board is a grid of 1x1-unit cells (WORLD_W x WORLD_H). Cells are
// walkable except for plateau cliffs (PLATEAUS in config.js): the outer
// CLIFF_W ring of each plateau, minus its ramp gap. Everything that moves
// soldiers around (combat.js, commands.js) asks this file three things:
//   - isBlocked(x, y)       can anyone stand here?
//   - lineClear(ax,ay,bx,by) is the straight walk between two points free of
//                           cliffs? (also used as "can these two even fight /
//                           see each other as a target" -- no fighting or
//                           chasing across a cliff)
//   - findPath(...)         the way around when the straight line isn't clear
// and terrainLevel() tells which plateau (if any) a point is up on.
//
// A* in C++ terms: a priority queue (binary min-heap, hand-rolled below since
// JS has no std::priority_queue) over grid cells, 8 neighbours, diagonal
// steps only when both adjacent straight cells are free (no cutting cliff
// corners), octile-distance heuristic.

const terrainBlocked = new Uint8Array(WORLD_W * WORLD_H); // 1 = cliff
const terrainLevel_ = new Int8Array(WORLD_W * WORLD_H);   // 0 ground, i+1 = up on plateau i, -1 = on a ramp

function cellIndex(cx, cy) {
  return cy * WORLD_W + cx;
}

// Is point (x, y) inside the ellipse centered on plateau p shrunk by `inset`?
function inEllipse(p, x, y, inset) {
  const dx = (x - p.cx) / (p.rx - inset);
  const dy = (y - p.cy) / (p.ry - inset);
  return dx * dx + dy * dy <= 1;
}

// A ring cell that's part of the ramp gap: within RAMP_W/2 of rampX, on the
// ramp's side of the plateau.
function inRampGap(p, x, y) {
  if (Math.abs(x - p.rampX) >= RAMP_W / 2) return false;
  return p.rampSide === 'top' ? y < p.cy : y > p.cy;
}

// Built once at load: the terrain never changes during a game. Each cell is
// judged by its center point.
(function buildTerrainGrid() {
  PLATEAUS.forEach((p, i) => {
    for (let cy = Math.floor(p.cy - p.ry); cy <= Math.ceil(p.cy + p.ry); cy++) {
      for (let cx = Math.floor(p.cx - p.rx); cx <= Math.ceil(p.cx + p.rx); cx++) {
        if (cx < 0 || cy < 0 || cx >= WORLD_W || cy >= WORLD_H) continue;
        const x = cx + 0.5;
        const y = cy + 0.5;
        if (!inEllipse(p, x, y, 0)) continue;
        const k = cellIndex(cx, cy);
        if (inEllipse(p, x, y, CLIFF_W)) {
          terrainLevel_[k] = i + 1;
        } else if (inRampGap(p, x, y)) {
          terrainLevel_[k] = -1;
        } else {
          terrainBlocked[k] = 1;
        }
      }
    }
  });
})();

function cellOf(v, max) {
  return Math.max(0, Math.min(max - 1, Math.floor(v)));
}

function isBlocked(x, y) {
  return terrainBlocked[cellIndex(cellOf(x, WORLD_W), cellOf(y, WORLD_H))] === 1;
}

// 0 = open ground, i+1 = up on plateau i, -1 = on a ramp.
function terrainLevel(x, y) {
  return terrainLevel_[cellIndex(cellOf(x, WORLD_W), cellOf(y, WORLD_H))];
}

// Samples the segment every half unit -- cells are 1 unit, cliffs 2 thick,
// so nothing can slip between samples.
function lineClear(ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 0.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isBlocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

// Nearest walkable point to (x, y) -- for clicks/orders that land on a
// cliff. Breadth-first search outward over cells.
function nearestWalkable(x, y) {
  if (!isBlocked(x, y)) return { x, y };
  const start = cellIndex(cellOf(x, WORLD_W), cellOf(y, WORLD_H));
  const seen = new Uint8Array(WORLD_W * WORLD_H);
  const queue = [start];
  seen[start] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    const cx = k % WORLD_W;
    const cy = (k - cx) / WORLD_W;
    if (!terrainBlocked[k]) return { x: cx + 0.5, y: cy + 0.5 };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue;
      const nk = cellIndex(nx, ny);
      if (!seen[nk]) { seen[nk] = 1; queue.push(nk); }
    }
  }
  return { x, y };
}

// A* from (ax, ay) to (bx, by). Returns a list of waypoints (cell centers,
// start excluded, ending exactly at the goal), or null if unreachable.
// Speed matters (it runs inside the game loop): the per-cell arrays are
// allocated once and reused -- a cell's data counts as fresh only when its
// stamp matches this search -- and the heap is two flat typed arrays.
// Ties between equally good cells are broken toward the goal (the heuristic
// is scaled up a hair), which on open ground keeps the search a narrow line
// instead of flooding the whole map.
const PATH_N = WORLD_W * WORLD_H;
const pathG = new Float32Array(PATH_N);
const pathFrom = new Int32Array(PATH_N);
const pathStamp = new Uint32Array(PATH_N);
const pathClosed = new Uint32Array(PATH_N);
let pathSearchId = 0;
const heapF = new Float32Array(PATH_N * 8);
const heapK = new Int32Array(PATH_N * 8);

function findPath(ax, ay, bx, by) {
  const goal = nearestWalkable(bx, by);
  const sx = cellOf(ax, WORLD_W);
  const sy = cellOf(ay, WORLD_H);
  const gx = cellOf(goal.x, WORLD_W);
  const gy = cellOf(goal.y, WORLD_H);
  const startK = cellIndex(sx, sy);
  const goalK = cellIndex(gx, gy);
  if (startK === goalK) return [goal];

  const id = ++pathSearchId;
  const heuristic = (cx, cy) => {
    const dx = Math.abs(cx - gx);
    const dy = Math.abs(cy - gy);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * 1.001;
  };
  let heapSize = 0;
  const push = (f, k) => {
    let i = heapSize++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heapF[parent] <= f) break;
      heapF[i] = heapF[parent];
      heapK[i] = heapK[parent];
      i = parent;
    }
    heapF[i] = f;
    heapK[i] = k;
  };
  const pop = () => {
    const top = heapK[0];
    const f = heapF[--heapSize];
    const k = heapK[heapSize];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= heapSize) break;
      const c = l + 1 < heapSize && heapF[l + 1] < heapF[l] ? l + 1 : l;
      if (heapF[c] >= f) break;
      heapF[i] = heapF[c];
      heapK[i] = heapK[c];
      i = c;
    }
    heapF[i] = f;
    heapK[i] = k;
    return top;
  };
  const gOf = k => (pathStamp[k] === id ? pathG[k] : Infinity);

  pathStamp[startK] = id;
  pathG[startK] = 0;
  pathFrom[startK] = -1;
  push(heuristic(sx, sy), startK);
  let found = false;
  while (heapSize) {
    const k = pop();
    if (pathClosed[k] === id) continue;
    if (k === goalK) { found = true; break; }
    pathClosed[k] = id;
    const cx = k % WORLD_W;
    const cy = (k - cx) / WORLD_W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue;
        const nk = cellIndex(nx, ny);
        if (terrainBlocked[nk] || pathClosed[nk] === id) continue;
        // No cutting a cliff corner diagonally.
        if (dx && dy && (terrainBlocked[cellIndex(cx + dx, cy)] || terrainBlocked[cellIndex(cx, cy + dy)])) continue;
        const g = pathG[k] + (dx && dy ? Math.SQRT2 : 1);
        if (g < gOf(nk)) {
          pathStamp[nk] = id;
          pathG[nk] = g;
          pathFrom[nk] = k;
          push(g + heuristic(nx, ny), nk);
        }
      }
    }
  }
  if (!found) return null;

  const path = [];
  for (let k = pathFrom[goalK]; k !== -1 && k !== startK; k = pathFrom[k]) {
    const cx = k % WORLD_W;
    path.push({ x: cx + 0.5, y: (k - cx) / WORLD_W + 0.5 });
  }
  path.reverse();
  path.push(goal);
  return path;
}
