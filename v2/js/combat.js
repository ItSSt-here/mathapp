// ---------- Soldiers: spawning, buying, and the per-tick battle loop ----------

// Spawns a soldier at its side's rally point -- unless an enemy has already
// marched past that point, in which case the new soldier spawns right next
// to the intruder instead, so it actually meets it instead of marching the
// wrong way past it.
function spawnSoldier(side) {
  const rallyX = side === 'player' ? PLAYER_SPAWN_X : COMPUTER_SPAWN_X;
  const opponentXs = soldiers
    .filter(s => s.side !== side)
    .map(s => s.x);

  let spawnX = rallyX;
  if (opponentXs.length) {
    if (side === 'player') {
      const deepestBreach = Math.max(...opponentXs);
      if (deepestBreach > rallyX) spawnX = deepestBreach;
    } else {
      const deepestBreach = Math.min(...opponentXs);
      if (deepestBreach < rallyX) spawnX = deepestBreach;
    }
  }

  soldiers.push({
    id: soldierId++,
    side,
    x: spawnX,
    hp: SOLDIER_HP,
    atkCooldown: 0,
    haltTimer: HALT_CHECK_INTERVAL_MS,
    halted: false,
    attacking: false,
    pose: 'walking',
    animPose: 'walking',
    frameIndex: 0
  });
}

function buySoldier() {
  if (gameOver || playerMoney < SOLDIER_COST || isStudyMode()) return;
  playerMoney -= SOLDIER_COST;
  updateCoinsDisplay();
  spawnSoldier('player');
}

function tick() {
  if (gameOver) return;

  battleElapsedMs += TICK_MS;

  // Enemy spawns on a flat timer -- unless this speed's tier is the
  // no-enemy study mode (see isStudyMode() in helpers.js).
  const spawnInterval = DIFFICULTY_SPAWN_INTERVALS_MS[difficultyIndex];
  if (spawnInterval != null) {
    enemySpawnTimer += TICK_MS;
    if (enemySpawnTimer >= spawnInterval) {
      enemySpawnTimer -= spawnInterval;
      spawnSoldier('computer');
    }
  }

  // Pair up each soldier with the nearest opponent in range, using current
  // positions (so soldiers that are already adjacent fight on the spot
  // instead of walking past each other). Dying soldiers are corpses -- they
  // no longer fight or get targeted.
  const livingSoldiers = soldiers.filter(s => !s.dying);
  const players = livingSoldiers.filter(s => s.side === 'player');
  const enemies = livingSoldiers.filter(s => s.side === 'computer');
  const opponentOf = new Map();

  for (const p of players) {
    let closest = null;
    let closestDist = Infinity;
    for (const e of enemies) {
      const dist = Math.abs(p.x - e.x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = e;
      }
    }
    if (closest && closestDist <= ENGAGE_RANGE) {
      opponentOf.set(p.id, closest);
      opponentOf.set(closest.id, p);
    }
  }

  // Melee: soldiers strike their opponent once their cooldown is ready
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
    }
  }
  soldiers = soldiers.filter(s => {
    if (!s.dying) return true;
    s.deathTimer -= TICK_MS;
    return s.deathTimer > 0;
  });

  // Everyone else: either march forward, or if already at the enemy castle,
  // besiege it (also cooldown-gated so damage doesn't land every tick)
  for (const s of soldiers) {
    if (s.dying) continue;
    const opp = opponentOf.get(s.id);
    const inMelee = opp && opp.hp > 0;
    s.attacking = false;
    if (inMelee) {
      s.attacking = true;
      continue;
    }

    const sieging = (s.side === 'player' && s.x <= PLAYER_SIEGE_X) ||
                    (s.side === 'computer' && s.x >= COMPUTER_SIEGE_X);

    if (sieging) {
      s.attacking = true;
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
    } else {
      s.atkCooldown = 0; // reset so the next contact strikes immediately

      s.haltTimer -= TICK_MS;
      if (s.haltTimer <= 0) {
        s.haltTimer = HALT_CHECK_INTERVAL_MS;
        s.halted = Math.random() < HALT_CHANCE;
      }

      if (!s.halted) {
        if (s.side === 'player') {
          s.x = Math.max(0, s.x - SOLDIER_SPEED);
        } else {
          s.x = Math.min(100, s.x + SOLDIER_SPEED);
        }
      }
    }
  }

  // Record which pose each soldier is in; actual frame advancement happens
  // on its own faster clock (see animTick() below) so combat/movement pacing
  // (TICK_MS) and sprite animation pacing (ANIM_TICK_MS) can differ. Reset
  // the frame here too (not just in animTick) so a pose change never briefly
  // shows a stale frame number carried over from the previous pose.
  for (const s of soldiers) {
    const pose = s.dying ? 'dying' : (s.attacking ? 'attacking' : (s.halted ? 'idle' : 'walking'));
    if (pose !== s.pose) {
      s.frameIndex = 0;
      s.animPose = pose;
    }
    s.pose = pose;
  }

  render();

  if (computerCastleHP <= 0) {
    endGame(true);
  } else if (playerCastleHP <= 0) {
    endGame(false);
  }
}

// Advances each soldier's sprite frame by exactly one step, strictly in
// order (never skipping around), resetting to frame 0 whenever its pose has
// changed since the last check. Runs on its own faster interval (see
// startGame() in main.js) so the animation itself can be smoother/quicker
// than the combat/movement tick that decides *which* pose a soldier is in.
function animTick() {
  if (gameOver) return;

  for (const s of soldiers) {
    if (s.pose !== s.animPose) {
      s.animPose = s.pose;
      s.frameIndex = 0;
    } else if (s.pose === 'dying') {
      s.frameIndex = Math.min(SPRITE_FRAME_COUNT - 1, s.frameIndex + 1);
    } else {
      s.frameIndex = (s.frameIndex + 1) % SPRITE_FRAME_COUNT;
    }
  }

  render();
}
