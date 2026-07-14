// ---------- Rendering: castles, soldiers, and battlefield geometry ----------
function castleImageStage(hp, maxHp) {
  const pct = (hp / maxHp) * 100;
  if (pct <= 15) return CASTLE_DAMAGE_STAGES[2];
  if (pct <= 50) return CASTLE_DAMAGE_STAGES[1];
  return CASTLE_DAMAGE_STAGES[0];
}

function castleImageSrc(side, hp, maxHp) {
  return `assets/castle/${side}/${castleImageStage(hp, maxHp)}.png`;
}

// Warms up both sides' castle damage-stage art the same way preloadSoldierSprites
// warms up soldier frames, so switching stages mid-battle never stalls on a
// first paint.
function preloadCastleSprites() {
  const container = document.getElementById('spritePreload');
  for (const side of ['player', 'enemy']) {
    for (const stage of CASTLE_DAMAGE_STAGES) {
      const img = document.createElement('img');
      img.src = `assets/castle/${side}/${stage}.png`;
      container.appendChild(img);
    }
  }
}

// Warms up every soldier sprite frame (both colors, every pose) by actually
// laying them out and painting them off-screen as soon as the page loads,
// using the exact same markup (.soldier/.soldier-figure, including the
// player side's mirroring) that the real battlefield uses. Fetching and
// decoding the bytes alone (e.g. via `new Image()`) isn't enough -- an
// element that's never inserted into the page never gets painted, so the
// browser still pays that first-paint cost live the first time a soldier
// actually enters a given pose. That first paint is what showed up as a
// brief flicker right after spawning, stopping, or engaging.
function preloadSoldierSprites() {
  const container = document.getElementById('spritePreload');
  const sideClassForColor = { blue: 'player', red: 'enemy' };

  for (const color of ['blue', 'red']) {
    for (const folder of Object.values(POSE_TO_SPRITE_FOLDER)) {
      for (let i = 1; i <= SPRITE_FRAME_COUNT; i++) {
        const wrap = document.createElement('div');
        wrap.className = `soldier ${sideClassForColor[color]}`;
        const img = document.createElement('img');
        img.className = 'soldier-figure';
        img.src = `assets/sprites/knight/${color}/${folder}/${i}.png`;
        wrap.appendChild(img);
        container.appendChild(wrap);
      }
    }
  }
}

// Picks the current sprite frame for a soldier: its side selects the color
// variant (blue/red, pre-tinted offline -- see assets/sprites/knight), and
// its pose selects the animation folder. s.frameIndex is advanced strictly
// one-by-one per tick in tick() (see combat.js), so this just reads it.
function soldierFrameSrc(s) {
  const color = s.side === 'player' ? 'blue' : 'red';
  const folder = POSE_TO_SPRITE_FOLDER[s.pose] || 'walk';
  return `assets/sprites/knight/${color}/${folder}/${s.frameIndex + 1}.png`;
}

function render() {
  document.getElementById('playerHpFill').style.width = `${(playerCastleHP / CASTLE_MAX_HP) * 100}%`;
  document.getElementById('enemyHpFill').style.width = `${(computerCastleHP / CASTLE_MAX_HP) * 100}%`;
  document.getElementById('playerHpText').textContent = `${playerCastleHP}/${CASTLE_MAX_HP}`;
  document.getElementById('enemyHpText').textContent = `${computerCastleHP}/${CASTLE_MAX_HP}`;

  document.getElementById('playerCastleImg').src = castleImageSrc('player', playerCastleHP, CASTLE_MAX_HP);
  document.getElementById('enemyCastleImg').src = castleImageSrc('enemy', computerCastleHP, CASTLE_MAX_HP);
  document.getElementById('playerCastleGraphic').classList.toggle(
    'dmg-severe', castleImageStage(playerCastleHP, CASTLE_MAX_HP) === CASTLE_DAMAGE_STAGES[2]);
  document.getElementById('enemyCastleGraphic').classList.toggle(
    'dmg-severe', castleImageStage(computerCastleHP, CASTLE_MAX_HP) === CASTLE_DAMAGE_STAGES[2]);

  document.getElementById('battleTimer').textContent = formatDuration(battleElapsedMs);

  renderSoldiers();
  updateCoinsDisplay();
}

// Persistent per-soldier DOM node cache, keyed by soldier id. render() used
// to rebuild soldiersLayer's entire innerHTML every tick, which meant every
// soldier's <div>/<img> was destroyed and recreated from scratch four times
// a second -- even when nothing about it had changed. That churn is what
// caused the flicker: recreating an <img> node forces the browser to redo
// its first paint of that element, which is far more noticeable right after
// a pose change (a big silhouette jump) than during continuous walking
// (subtle frame-to-frame differences). Now each soldier gets one stable set
// of elements for its whole lifetime, and render() only updates their
// style/class/src in place.
const soldierElements = new Map();

function renderSoldiers() {
  const soldiersLayer = document.getElementById('soldiersLayer');
  const liveIds = new Set();

  for (const s of soldiers) {
    liveIds.add(s.id);
    let refs = soldierElements.get(s.id);
    if (!refs) {
      const wrap = document.createElement('div');
      const hpBar = document.createElement('div');
      hpBar.className = 'soldier-hp';
      const hpFill = document.createElement('div');
      hpFill.className = 'soldier-hp-fill';
      hpBar.appendChild(hpFill);
      const img = document.createElement('img');
      img.className = 'soldier-figure';
      img.alt = '';
      wrap.appendChild(hpBar);
      wrap.appendChild(img);
      soldiersLayer.appendChild(wrap);
      refs = { wrap, hpFill, img };
      soldierElements.set(s.id, refs);
    }

    const sideClass = s.side === 'player' ? 'player' : 'enemy';
    refs.wrap.className = `soldier ${sideClass} ${s.pose}`;
    refs.wrap.style.left = `${s.x}%`;

    // The fade-out is recomputed from the death timer on every render rather
    // than played as a CSS animation, since it needs to survive this element
    // being reused across many ticks. The fall/topple itself is handled by
    // the 'dead' sprite frames, not computed here.
    if (s.dying) {
      const elapsed = DEATH_FADE_MS - s.deathTimer;
      const fadeElapsed = elapsed - (DEATH_FADE_MS - FADE_DURATION_MS);
      refs.wrap.style.opacity = fadeElapsed > 0 ? Math.max(0, 1 - fadeElapsed / FADE_DURATION_MS) : 1;
    } else {
      refs.wrap.style.opacity = '';
    }

    refs.hpFill.style.width = `${Math.max(0, s.hp) / SOLDIER_HP * 100}%`;

    // Only touch `src` when the frame actually changed, so the browser isn't
    // asked to redecode/repaint the same image every tick.
    const newSrc = soldierFrameSrc(s);
    if (!refs.img.src.endsWith(newSrc)) {
      refs.img.src = newSrc;
    }
  }

  // Soldiers that finished fading out and were removed from the array: drop
  // their DOM nodes too.
  for (const [id, refs] of soldierElements) {
    if (!liveIds.has(id)) {
      refs.wrap.remove();
      soldierElements.delete(id);
    }
  }
}

// Measures the castle graphic and battlefield in the real, laid-out DOM so
// soldiers always stop right at the castle's outer wall (leaving its
// artwork fully visible) instead of marching on top of it -- this adapts
// automatically to the actual rendered size instead of a guessed percentage.
// The same measurement gives us the spawn points: right at each castle's
// own outer wall, so a new soldier appears to step out of it.
function recalcSiegeThresholds() {
  const battlefieldWidth = document.getElementById('battlefield').getBoundingClientRect().width;
  const castleWidth = document.getElementById('playerCastleGraphic').getBoundingClientRect().width;
  if (battlefieldWidth <= 0 || castleWidth <= 0) return;

  const soldierHalfWidth = 25; // soldier is 50px wide, centered on its x position
  const castleInset = 2;
  const bufferPercent = ((castleWidth + castleInset + soldierHalfWidth) / battlefieldWidth) * 100
    + SOLDIER_SPEED; // extra margin so a soldier's one-step overshoot never lands inside the castle
  const wallPercent = ((castleWidth + castleInset) / battlefieldWidth) * 100;

  PLAYER_SIEGE_X = bufferPercent;
  COMPUTER_SIEGE_X = 100 - bufferPercent;

  PLAYER_SPAWN_X = 100 - wallPercent;
  COMPUTER_SPAWN_X = wallPercent;
}
