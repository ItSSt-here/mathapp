// ---------- Soldiers: spawning, buying, enemy AI, and the per-tick battle loop ----------
//
// Warcraft-style control (see [[project_2d_board_v2]] in memory): nobody
// marches on their own anymore. Every soldier runs the same small priority
// list each tick (see updateSoldier() below):
//   1. an opponent within ENGAGE_RANGE -> fight it on the spot
//   2. an opponent within AGGRO_RANGE  -> walk to it (an existing order is
//      kept, not cleared, so the soldier resumes it once the fight is over)
//   3. an order (player's right-click, or a raider squad's attack) -> follow it
//   4. a home spot (guard post / raider gathering spot) -> walk back to it
//   5. the enemy castle within AGGRO_RANGE -> walk up to it and besiege it
//   6. otherwise stand still
// The fields that make the three kinds of soldier differ are just data:
//   s.order -- null, a point {x, y}, or {x, y, castle: true} (walk to the
//              enemy castle and besiege it until told otherwise)
//   s.home  -- null or a point to return to when there's nothing else to do
//   s.leash -- null, or how far from s.home an intruder may be and still get
//              chased (guards only -- so they can't be lured away forever)

const HOME_TOLERANCE = 2; // "close enough" to home that a separation nudge doesn't send it walking back

function jitter(amount) {
  return (Math.random() * 2 - 1) * amount;
}

function clampToBoard(s) {
  s.x = Math.max(0, Math.min(WORLD_W, s.x));
  s.y = Math.max(Y_MOVE_MIN, Math.min(Y_MOVE_MAX, s.y));
}

function spawnSoldier(side, role, x, y, home, leash) {
  const s = {
    id: soldierId++,
    side,
    role,
    x,
    y,
    hp: SOLDIER_HP,
    atkCooldown: 0,
    order: null,
    home: home || null,
    leash: leash || null,
    attacking: false,
    moving: false,
    faceLeft: side === 'player', // each side starts out facing the other
    facingDeg: side === 'player' ? 180 : 0,
    attackDir: 'side', // 'side' | 'up' | 'down' -- which attack animation to play
    pose: 'idle',
    anim: 'idle',      // key into SOLDIER_ANIMS (config.js), see soldierAnimKey()
    frameIndex: 0
  };
  clampToBoard(s);
  soldiers.push(s);
  return s;
}

// Called by startGame(): the enemy's fixed guards exist from the first
// second -- but not in the no-enemy study mode (see isStudyMode()), and not
// when red is a human team (see matchMode, match.js).
function setupEnemyForces() {
  enemySquadSize = randInt(ENEMY_SQUAD_MIN, ENEMY_SQUAD_MAX);
  if (matchMode !== 'computer' || isStudyMode()) return;
  for (const post of ENEMY_GUARD_POSTS) {
    spawnSoldier('computer', 'guard', post.x, post.y, post, GUARD_LEASH);
  }
}

function livingSoldierCount(side) {
  return soldiers.filter(s => s.side === side && !s.dying).length;
}

// A human team buys a soldier (via the 'buy' command, match.js): it
// appears at that team's own tower gate.
function buySoldier(side) {
  const team = sides[side];
  if (gameOver || team.money < team.params.soldierCost || isStudyMode()) return;
  if (livingSoldierCount(side) >= MAX_SOLDIERS_PER_SIDE) return;
  team.money -= team.params.soldierCost;
  const rally = rallyPoint(side);
  spawnSoldier(side, 'player', rally.x + jitter(RALLY_JITTER.x), rally.y + jitter(RALLY_JITTER.y));
}

// ---------- Gold mines (see MINE_SITES etc. in config.js) ----------
function setupMines() {
  mines = MINE_SITES.map((site, i) => ({
    id: i, x: site.x, y: site.y, level: site.plateau + 1, hold: site.hold,
    owner: null, captureSide: null, captureMs: 0
  }));
  // Neutral guards (purple, their own 'neutral' side): stand at their posts
  // up on the mine's plateau, only ever go after intruders who are up on
  // that same plateau (never down the ramp -- see updateSoldier()), and
  // are never replaced. Not in the no-enemy study mode.
  if (isStudyMode()) return;
  mines.forEach((m, i) => {
    for (const post of MINE_SITES[i].guardPosts) {
      const g = spawnSoldier('neutral', 'mineKeeper', post.x, post.y, post, MINE_GUARD_LEASH);
      g.mineId = m.id;
      g.plateauLevel = m.level;
    }
  });
}

function mineKeepersLeft(m) {
  return soldiers.filter(s => s.role === 'mineKeeper' && !s.dying && s.mineId === m.id).length;
}

function mineCount(side) {
  return mines.filter(m => m.owner === side).length;
}

// Capture progress: soldiers of exactly one side up on a mine's plateau
// (terrainLevel(), terrain.js -- the ramp doesn't count) fill its ring; once full the mine flips to them. Both sides there
// = contested, progress pauses; nobody there = progress drains away.
function tickMines(livingSoldiers) {
  for (const m of mines) {
    let players = 0;
    let computers = 0;
    for (const s of livingSoldiers) {
      if (s.side === 'neutral' || terrainLevel(s.x, s.y) !== m.level) continue;
      if (s.side === 'player') players++; else computers++;
    }
    // Nobody can take a mine while any of its neutral guards still stands.
    const guarded = mineKeepersLeft(m) > 0;
    const side = guarded ? null
      : (players && !computers ? 'player' : (computers && !players ? 'computer' : null));
    if (side && side !== m.owner) {
      if (m.captureSide !== side) { m.captureSide = side; m.captureMs = 0; }
      m.captureMs += TICK_MS;
      if (m.captureMs >= MINE_CAPTURE_MS) {
        m.owner = side;
        m.captureSide = null;
        m.captureMs = 0;
      }
    } else if (!players && !computers) {
      m.captureMs = Math.max(0, m.captureMs - TICK_MS);
      if (!m.captureMs) m.captureSide = null;
    }
    // Contested, or the owner is standing on its own mine: progress holds.
  }
}

// Where an enemy squad that went for a mine stands guard: around the mine
// site's `hold` point up on its plateau.
function mineGuardSpot(m) {
  return nearestWalkable(m.hold.x + jitter(4), m.hold.y + jitter(2));
}

// Enemy spawning + squad logic: new raiders gather at their own spot near
// ENEMY_RALLY (each gets its own jittered home, so separation nudges don't
// make a crowd shuffle forever). Once enough are gathered, the squad either
// goes to take a mine it doesn't own and stays to guard it
// (ENEMY_MINE_RAID_CHANCE), or marches on the player's castle; then a new
// random squad size is drawn. Every mine it owns spawns soldiers faster.
function tickEnemyAI() {
  const baseInterval = DIFFICULTY_SPAWN_INTERVALS_MS[difficultyIndex];
  if (baseInterval == null) return; // study mode: no enemy at all
  const spawnInterval = baseInterval * Math.max(0.4, 1 - ENEMY_MINE_SPAWN_SPEEDUP * mineCount('computer'));

  enemySpawnTimer += TICK_MS;
  if (enemySpawnTimer >= spawnInterval) {
    enemySpawnTimer -= spawnInterval;
    // At the cap this spawn is simply skipped (not queued for later).
    if (livingSoldierCount('computer') < MAX_SOLDIERS_PER_SIDE) {
      const home = { x: ENEMY_RALLY.x + jitter(4), y: ENEMY_RALLY.y + jitter(3) };
      // Steps out of the castle gate (the bottom middle of its art).
      spawnSoldier('computer', 'raider', COMPUTER_CASTLE_POS.x, COMPUTER_CASTLE_POS.y + 2, home);
    }
  }

  const gathering = soldiers.filter(s => s.role === 'raider' && !s.dying && !s.order);
  if (gathering.length >= enemySquadSize) {
    // A mine worth taking: not already the enemy's, not already being
    // guarded by an earlier enemy squad, and with no more neutral guards
    // left than this squad has soldiers. Nearest to the enemy castle first.
    const guarded = new Set(soldiers.filter(s => s.role === 'mineGuard' && !s.dying).map(s => s.mineId));
    const targets = mines
      .filter(m => m.owner !== 'computer' && !guarded.has(m.id) && mineKeepersLeft(m) <= gathering.length)
      .sort((a, b) => Math.hypot(a.x - COMPUTER_CASTLE_POS.x, a.y - COMPUTER_CASTLE_POS.y)
                    - Math.hypot(b.x - COMPUTER_CASTLE_POS.x, b.y - COMPUTER_CASTLE_POS.y));
    const mine = targets.length && Math.random() < ENEMY_MINE_RAID_CHANCE ? targets[0] : null;
    for (const r of gathering) {
      if (mine) {
        // Walks to the mine via its home spot and stays there for good
        // (home + normal aggro = it chases intruders, then comes back).
        r.role = 'mineGuard';
        r.mineId = mine.id;
        r.home = mineGuardSpot(mine);
      } else {
        r.home = null;
        r.order = { x: PLAYER_CASTLE_POS.x, y: PLAYER_CASTLE_POS.y, castle: true };
      }
    }
    enemySquadSize = randInt(ENEMY_SQUAD_MIN, ENEMY_SQUAD_MAX);
  }
}

// Nearest living opponent to `s` within maxDist (Infinity = any distance),
// optionally also filtered by `accept(o)`.
function nearestOpponent(s, opponents, maxDist, accept) {
  let closest = null;
  let closestDist = maxDist;
  for (const o of opponents) {
    const d = Math.hypot(s.x - o.x, s.y - o.y);
    if (d <= closestDist && (!accept || accept(o))) { closestDist = d; closest = o; }
  }
  return closest;
}

// One step straight toward (tx, ty), at its exact angle. (Movement used to
// be snapped to 8 compass directions; with cliffs on the board that made
// soldiers drift off a clear straight line into a cliff corner and get
// stuck there -- so only the *facing* is snapped now, to the nearest of 8
// directions, as facingDeg for a future 8-directional sprite.) Lands exactly
// on the target when it's within one step, so arrivals never overshoot.
function stepToward(s, tx, ty) {
  const dist = Math.hypot(tx - s.x, ty - s.y);
  if (dist <= SOLDIER_SPEED) {
    s.x = tx;
    s.y = ty;
  } else {
    const angle = Math.atan2(ty - s.y, tx - s.x);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    s.facingDeg = ((Math.round(snapped * 180 / Math.PI) % 360) + 360) % 360;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    if (dx < -0.01) s.faceLeft = true;
    else if (dx > 0.01) s.faceLeft = false;
    // Never step into a cliff: try the full diagonal/straight step, then
    // each axis on its own (sliding along the cliff), else stay put.
    const ox = s.x;
    const oy = s.y;
    for (const [mx, my] of [[dx, dy], [dx, 0], [0, dy]]) {
      if (!mx && !my) continue;
      s.x = ox + mx * SOLDIER_SPEED;
      s.y = oy + my * SOLDIER_SPEED;
      clampToBoard(s);
      if (!isBlocked(s.x, s.y)) break;
      s.x = ox;
      s.y = oy;
    }
  }
  clampToBoard(s);
  s.moving = true;
}

// Walks toward (tx, ty) around any cliffs in the way: straight (stepToward)
// while the direct line is clear, otherwise along an A* path (findPath(),
// terrain.js). The path is cached on the soldier and only recomputed when
// the target moves to a different 3-unit square or every PATH_REFRESH_TICKS
// ticks, and waypoints are skipped whenever a later one is already in clear
// view, so the walk doesn't zigzag cell by cell.
const PATH_REFRESH_TICKS = 8;
function moveToward(s, tx, ty) {
  if (lineClear(s.x, s.y, tx, ty)) {
    s.path = null;
    stepToward(s, tx, ty);
    return;
  }
  const key = `${Math.round(tx / 3)},${Math.round(ty / 3)}`;
  if (!s.path || s.pathKey !== key || --s.pathAge <= 0) {
    s.path = findPath(s.x, s.y, tx, ty);
    s.pathKey = key;
    s.pathAge = PATH_REFRESH_TICKS + (s.id % 4); // staggered, so a whole group doesn't recompute on the same tick
  }
  if (!s.path || !s.path.length) return; // unreachable: stand still
  while (s.path.length > 1 && lineClear(s.x, s.y, s.path[1].x, s.path[1].y)) s.path.shift();
  if (Math.hypot(s.path[0].x - s.x, s.path[0].y - s.y) <= SOLDIER_SPEED && s.path.length > 1) s.path.shift();
  stepToward(s, s.path[0].x, s.path[0].y);
}

// Straight-line distance from soldier s to the nearest point of a castle's
// ground footprint (see CASTLE_HALF_W/CASTLE_DEPTH in config.js); 0 if the
// soldier is standing on it.
function castleDistance(s, castlePos) {
  const dx = Math.max(0, Math.abs(s.x - castlePos.x) - CASTLE_HALF_W);
  const dy = Math.max(0, castlePos.y - CASTLE_DEPTH - s.y, s.y - castlePos.y);
  return Math.hypot(dx, dy);
}

// Turns to face a target point and picks which of the 3 attack animations
// (sideways / up / down) fits the direction it's in.
function faceTarget(s, tx, ty) {
  const dx = tx - s.x;
  const dy = ty - s.y;
  if (Math.abs(dy) > Math.abs(dx) * 1.2) {
    s.attackDir = dy < 0 ? 'up' : 'down';
  } else {
    s.attackDir = 'side';
  }
  if (Math.abs(dx) > 0.01) s.faceLeft = dx < 0;
}

function besiege(s, castlePos) {
  s.attacking = true;
  // Face the nearest point of the castle's footprint: soldiers beside it
  // swing sideways, soldiers below its front wall swing up at it.
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  faceTarget(s,
    clamp(s.x, castlePos.x - CASTLE_HALF_W, castlePos.x + CASTLE_HALF_W),
    clamp(s.y, castlePos.y - CASTLE_DEPTH, castlePos.y));
  if (s.atkCooldown <= 0) {
    const dmg = strikeDamage();
    if (s.side === 'player') {
      computerCastleHP = Math.max(0, computerCastleHP - dmg);
    } else {
      playerCastleHP = Math.max(0, playerCastleHP - dmg);
    }
    s.atkCooldown = STRIKE_INTERVAL_MS;
  } else {
    s.atkCooldown -= TICK_MS;
  }
}

// Priority list documented at the top of this file. Melee (priority 1) is
// resolved before this runs, in tick().
function updateSoldier(s, opponents) {
  // A leashed soldier (guard) reacts to any intruder inside its leash zone
  // around its post, however far that is from where it currently stands --
  // so guards actually defend their castle instead of watching it get
  // besieged from just outside AGGRO_RANGE.
  // Nobody targets an enemy across a cliff (lineClear, terrain.js): an army
  // walking below a plateau isn't pulled up its ramp by guards it can see.
  // Mine guards only go after intruders up on their own plateau.
  const inSight = o => lineClear(s.x, s.y, o.x, o.y);
  const threat = s.plateauLevel
    ? nearestOpponent(s, opponents, Infinity,
        o => terrainLevel(o.x, o.y) === s.plateauLevel
          && Math.hypot(o.x - s.home.x, o.y - s.home.y) <= s.leash)
    : s.leash == null
      ? nearestOpponent(s, opponents, AGGRO_RANGE, inSight)
      : nearestOpponent(s, opponents, Infinity,
          o => Math.hypot(o.x - s.home.x, o.y - s.home.y) <= s.leash && inSight(o));
  if (threat) {
    moveToward(s, threat.x, threat.y);
    return;
  }

  const enemyCastle = s.side === 'player' ? COMPUTER_CASTLE_POS : PLAYER_CASTLE_POS;
  const atEnemyCastle = castleDistance(s, enemyCastle) <= CASTLE_REACH;

  if (s.order) {
    if (s.order.castle) {
      if (atEnemyCastle) besiege(s, enemyCastle);
      else moveToward(s, s.order.x, s.order.y);
    } else {
      moveToward(s, s.order.x, s.order.y);
      if (s.x === s.order.x && s.y === s.order.y) s.order = null;
    }
    return;
  }

  if (s.home && Math.hypot(s.x - s.home.x, s.y - s.home.y) > HOME_TOLERANCE) {
    moveToward(s, s.home.x, s.home.y);
    return;
  }
  if (s.side === 'neutral') return; // mine guards have no castle to attack

  // Idle, but the enemy castle is in sight (AGGRO_RANGE, same as for enemy
  // soldiers): walk up to its nearest wall and besiege it. Without this, a
  // soldier moved near the castle but stopping just out of CASTLE_REACH
  // would stand there doing nothing.
  const castleDist = castleDistance(s, enemyCastle);
  if (castleDist <= CASTLE_REACH) {
    besiege(s, enemyCastle);
  } else if (castleDist <= AGGRO_RANGE) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    moveToward(s,
      clamp(s.x, enemyCastle.x - CASTLE_HALF_W, enemyCastle.x + CASTLE_HALF_W),
      clamp(s.y, enemyCastle.y - CASTLE_DEPTH, enemyCastle.y));
  }
}

// Nudges overlapping soldiers apart so a group stays readable as separate
// figures instead of stacking into one sprite. Corpses don't take part.
function separateSoldiers(living) {
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i];
      const b = living[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= SEPARATION_DIST) continue;
      if (d === 0) { dx = jitter(1); dy = jitter(1); d = Math.hypot(dx, dy) || 1; }
      const push = (SEPARATION_DIST - d) / 4; // gentle: resolves over a few ticks
      for (const [u, sign] of [[a, -1], [b, 1]]) {
        const ox = u.x;
        const oy = u.y;
        u.x += sign * dx / d * push;
        u.y += sign * dy / d * push;
        clampToBoard(u);
        if (isBlocked(u.x, u.y)) { u.x = ox; u.y = oy; } // never pushed into a cliff
      }
    }
  }
}

function tick() {
  // matchPaused: a PvP opponent dropped out, the battle waits (sync.js).
  if (gameOver || matchPaused) return;

  battleElapsedMs += TICK_MS;
  if (matchMode === 'computer') tickEnemyAI();

  const livingSoldiers = soldiers.filter(s => !s.dying);
  // Three sides now (player, computer, and the neutral gold-mine guards):
  // everyone not on your side is an opponent.
  const opponentsOf = (s, pool) => pool.filter(o => o.side !== s.side);

  // Melee pairing: every soldier (every side, computed independently)
  // fights its nearest opponent within actual contact range.
  const opponentOf = new Map();
  for (const s of livingSoldiers) {
    const opp = nearestOpponent(s, opponentsOf(s, livingSoldiers), ENGAGE_RANGE,
      o => lineClear(s.x, s.y, o.x, o.y)); // no fighting across a cliff
    if (opp) opponentOf.set(s.id, opp);
  }

  for (const s of livingSoldiers) {
    const opp = opponentOf.get(s.id);
    if (!opp) continue;
    if (s.atkCooldown <= 0) {
      opp.hp -= strikeDamage();
      s.atkCooldown = STRIKE_INTERVAL_MS;
    } else {
      s.atkCooldown -= TICK_MS;
    }
  }

  // Soldiers that just died fall over and lie there for a while instead of
  // vanishing immediately; the death animation timer is what actually
  // removes them once it runs out.
  for (const s of livingSoldiers) {
    if (s.hp <= 0) {
      s.dying = true;
      s.deathTimer = DEATH_FADE_MS;
      s.attacking = false;
      s.moving = false;
      selectedIds.delete(s.id);
    }
  }
  soldiers = soldiers.filter(s => {
    if (!s.dying) return true;
    s.deathTimer -= TICK_MS;
    return s.deathTimer > 0;
  });

  const stillLiving = livingSoldiers.filter(s => !s.dying);

  for (const s of stillLiving) {
    s.attacking = false;
    s.moving = false;
    const opp = opponentOf.get(s.id);
    if (opp && opp.hp > 0) {
      s.attacking = true;
      faceTarget(s, opp.x, opp.y);
      continue;
    }
    updateSoldier(s, opponentsOf(s, stillLiving));
    if (!s.attacking) s.atkCooldown = 0; // so the next contact strikes immediately
  }

  separateSoldiers(stillLiving);
  tickMines(stillLiving);

  // Record which pose/animation each soldier is in; actual frame advancement
  // happens on its own faster clock (see animTick() below) so combat/movement
  // pacing (TICK_MS) and sprite animation pacing (ANIM_TICK_MS) can differ.
  // Switching animation (including just the attack direction) restarts it
  // from its first frame.
  for (const s of soldiers) {
    s.pose = s.dying ? 'dying' : (s.attacking ? 'attacking' : (s.moving ? 'walking' : 'idle'));
    const anim = soldierAnimKey(s);
    if (anim !== s.anim) {
      s.anim = anim;
      s.frameIndex = 0;
    }
  }

  render();
  if (isPvpHost()) publishPvpState(); // the guest's browser draws this (sync.js)

  if (computerCastleHP <= 0) {
    finishMatch('player');
  } else if (playerCastleHP <= 0) {
    finishMatch('computer');
  }
}

function soldierAnimKey(s) {
  if (s.pose === 'dying') return 'dying';
  if (s.pose === 'attacking') return `attack_${s.attackDir}`;
  return s.pose; // 'walking' | 'idle'
}

// Advances each soldier's sprite frame by exactly one step, strictly in
// order. Runs on its own faster interval (see startGame() in main.js) so the
// animation itself can be smoother/quicker than the combat/movement tick
// that decides *which* animation a soldier is in. Every animation loops
// except dying: the skull pops out, lies still on DEATH_HOLD_FRAME, and only
// plays its sinking-away frames during the last DEATH_SINK_MS before the
// soldier is removed.
function animTick() {
  if (gameOver) return;

  for (const s of soldiers) {
    const count = SOLDIER_ANIMS[s.anim].frames.length;
    if (s.anim === 'dying') {
      const cap = s.deathTimer <= DEATH_SINK_MS ? count - 1 : DEATH_HOLD_FRAME;
      s.frameIndex = Math.min(cap, s.frameIndex + 1);
    } else {
      s.frameIndex = (s.frameIndex + 1) % count;
    }
  }

  render();
}
