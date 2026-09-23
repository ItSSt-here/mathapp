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
// second -- but not in the no-enemy study mode (see isStudyMode()).
function setupEnemyForces() {
  enemySquadSize = randInt(ENEMY_SQUAD_MIN, ENEMY_SQUAD_MAX);
  if (isStudyMode()) return;
  for (const post of ENEMY_GUARD_POSTS) {
    spawnSoldier('computer', 'guard', post.x, post.y, post, GUARD_LEASH);
  }
}

function livingSoldierCount(side) {
  return soldiers.filter(s => s.side === side && !s.dying).length;
}

function buySoldier() {
  if (gameOver || playerMoney < SOLDIER_COST || isStudyMode()) return;
  if (livingSoldierCount('player') >= MAX_SOLDIERS_PER_SIDE) return;
  playerMoney -= SOLDIER_COST;
  updateCoinsDisplay();
  spawnSoldier('player', 'player',
    PLAYER_RALLY.x + jitter(RALLY_JITTER.x), PLAYER_RALLY.y + jitter(RALLY_JITTER.y));
}

// Enemy spawning + squad logic: new raiders gather at their own spot near
// ENEMY_RALLY (each gets its own jittered home, so separation nudges don't
// make a crowd shuffle forever), and once enough are gathered the whole
// squad is sent at the player's castle and a new random squad size is drawn.
function tickEnemyAI() {
  const spawnInterval = DIFFICULTY_SPAWN_INTERVALS_MS[difficultyIndex];
  if (spawnInterval == null) return; // study mode: no enemy at all

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
    for (const r of gathering) {
      r.home = null;
      r.order = { x: PLAYER_CASTLE_POS.x, y: PLAYER_CASTLE_POS.y, castle: true };
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

// One step toward (tx, ty), snapped to the nearest of 8 compass directions
// (45 deg apart) -- keeps movement grid-like and gives a future 8-directional
// sprite a fixed set of angles (facingDeg) to key off. Lands exactly on the
// target when it's within one step, so arrivals never overshoot/jitter.
function stepToward(s, tx, ty) {
  const dist = Math.hypot(tx - s.x, ty - s.y);
  if (dist <= SOLDIER_SPEED) {
    s.x = tx;
    s.y = ty;
  } else {
    const angle = Math.atan2(ty - s.y, tx - s.x);
    const step = Math.PI / 4;
    const snapped = Math.round(angle / step) * step;
    s.facingDeg = ((Math.round(snapped * 180 / Math.PI) % 360) + 360) % 360;
    const dx = Math.cos(snapped);
    if (dx < -0.01) s.faceLeft = true;
    else if (dx > 0.01) s.faceLeft = false;
    s.x += dx * SOLDIER_SPEED;
    s.y += Math.sin(snapped) * SOLDIER_SPEED;
  }
  clampToBoard(s);
  s.moving = true;
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
  const threat = s.leash == null
    ? nearestOpponent(s, opponents, AGGRO_RANGE)
    : nearestOpponent(s, opponents, Infinity,
        o => Math.hypot(o.x - s.home.x, o.y - s.home.y) <= s.leash);
  if (threat) {
    stepToward(s, threat.x, threat.y);
    return;
  }

  const enemyCastle = s.side === 'player' ? COMPUTER_CASTLE_POS : PLAYER_CASTLE_POS;
  const atEnemyCastle = castleDistance(s, enemyCastle) <= CASTLE_REACH;

  if (s.order) {
    if (s.order.castle) {
      if (atEnemyCastle) besiege(s, enemyCastle);
      else stepToward(s, s.order.x, s.order.y);
    } else {
      stepToward(s, s.order.x, s.order.y);
      if (s.x === s.order.x && s.y === s.order.y) s.order = null;
    }
    return;
  }

  if (s.home && Math.hypot(s.x - s.home.x, s.y - s.home.y) > HOME_TOLERANCE) {
    stepToward(s, s.home.x, s.home.y);
    return;
  }

  // Idle, but the enemy castle is in sight (AGGRO_RANGE, same as for enemy
  // soldiers): walk up to its nearest wall and besiege it. Without this, a
  // soldier moved near the castle but stopping just out of CASTLE_REACH
  // would stand there doing nothing.
  const castleDist = castleDistance(s, enemyCastle);
  if (castleDist <= CASTLE_REACH) {
    besiege(s, enemyCastle);
  } else if (castleDist <= AGGRO_RANGE) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    stepToward(s,
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
      a.x -= dx / d * push; a.y -= dy / d * push;
      b.x += dx / d * push; b.y += dy / d * push;
      clampToBoard(a);
      clampToBoard(b);
    }
  }
}

function tick() {
  if (gameOver) return;

  battleElapsedMs += TICK_MS;
  tickEnemyAI();

  const livingSoldiers = soldiers.filter(s => !s.dying);
  const players = livingSoldiers.filter(s => s.side === 'player');
  const enemies = livingSoldiers.filter(s => s.side === 'computer');

  // Melee pairing: every soldier (both sides, computed independently)
  // fights its nearest opponent within actual contact range.
  const opponentOf = new Map();
  for (const s of livingSoldiers) {
    const opp = nearestOpponent(s, s.side === 'player' ? enemies : players, ENGAGE_RANGE);
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
  const livingPlayers = stillLiving.filter(s => s.side === 'player');
  const livingEnemies = stillLiving.filter(s => s.side === 'computer');

  for (const s of stillLiving) {
    s.attacking = false;
    s.moving = false;
    const opp = opponentOf.get(s.id);
    if (opp && opp.hp > 0) {
      s.attacking = true;
      faceTarget(s, opp.x, opp.y);
      continue;
    }
    updateSoldier(s, s.side === 'player' ? livingEnemies : livingPlayers);
    if (!s.attacking) s.atkCooldown = 0; // so the next contact strikes immediately
  }

  separateSoldiers(stillLiving);

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

  if (computerCastleHP <= 0) {
    endGame(true);
  } else if (playerCastleHP <= 0) {
    endGame(false);
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
