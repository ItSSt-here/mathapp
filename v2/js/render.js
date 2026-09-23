// ---------- Rendering: castles, soldiers, and battlefield geometry ----------
// Team-colored castle while standing, the shared ruin once HP hits 0.
function castleImageSrc(side, hp) {
  if (hp <= 0) return 'assets/buildings/castle-destroyed.png';
  return `assets/buildings/castle-${side === 'player' ? 'blue' : 'red'}.png`;
}

// How many of a castle's fires are burning (see CASTLE_FIRE_*_PCT, config.js).
function castleFireLevel(hp) {
  const pct = hp / CASTLE_MAX_HP * 100;
  if (hp <= 0) return 0; // a ruin doesn't burn
  if (pct <= CASTLE_FIRE_2_PCT) return 2;
  if (pct <= CASTLE_FIRE_1_PCT) return 1;
  return 0;
}

// Updates one castle graphic's image and fires, touching the DOM only when
// something actually changed (this runs on every render).
function renderCastle(graphicId, imgId, side, hp) {
  const img = document.getElementById(imgId);
  const src = castleImageSrc(side, hp);
  if (!img.src.endsWith(src)) img.src = src;
  const graphic = document.getElementById(graphicId);
  const level = castleFireLevel(hp);
  graphic.classList.toggle('fire-1', level >= 1);
  graphic.classList.toggle('fire-2', level >= 2);
}

// Warms up the castle, ruin and fire art the same way preloadSoldierSprites
// warms up soldier frames, so the first fire or the ruin never flickers in.
function preloadCastleSprites() {
  const container = document.getElementById('spritePreload');
  for (const src of ['assets/buildings/castle-blue.png', 'assets/buildings/castle-red.png',
                     'assets/buildings/castle-destroyed.png', 'assets/effects/fire.png']) {
    const img = document.createElement('img');
    img.src = src;
    container.appendChild(img);
  }
}

// Warms up the three soldier sprite sheets (blue, red, skull) by actually
// laying them out and painting them off-screen as soon as the page loads,
// using the same .soldier/.soldier-figure markup the battlefield uses.
// Fetching the bytes alone isn't enough -- an element that's never painted
// still pays its first-paint cost live, which shows up as a brief flicker
// the first time a soldier appears or dies.
function preloadSoldierSprites() {
  const container = document.getElementById('spritePreload');
  for (const url of [soldierSheetUrl('player', 'warrior'), soldierSheetUrl('computer', 'warrior'),
                     soldierSheetUrl('player', 'dead')]) {
    const wrap = document.createElement('div');
    wrap.className = 'soldier';
    wrap.style.width = '64px'; // outside the board, --world-w (its normal sizing) doesn't apply
    const fig = document.createElement('div');
    fig.className = 'soldier-figure';
    fig.style.backgroundImage = `url('${url}')`;
    wrap.appendChild(fig);
    container.appendChild(wrap);
  }
}

// Team color picks the warrior sheet (blue = player, red = enemy); the
// skull sheet is shared by both sides.
function soldierSheetUrl(side, sheet) {
  if (sheet === 'dead') return 'assets/sprites/warrior/dead.png';
  return `assets/sprites/warrior/${side === 'player' ? 'blue' : 'red'}.png`;
}

// CSS for showing soldier s's current frame out of its sprite sheet:
// background-size scales the whole sheet so exactly one frame fills the
// element, and background-position (in %, where 0% = first column/row and
// 100% = last) picks which frame.
function soldierFrameStyle(s) {
  const anim = SOLDIER_ANIMS[s.anim];
  const sheet = SOLDIER_SHEETS[anim.sheet];
  const [col, row] = anim.frames[Math.min(s.frameIndex, anim.frames.length - 1)];
  return {
    image: `url('${soldierSheetUrl(s.side, anim.sheet)}')`,
    size: `${sheet.cols * 100}% ${sheet.rows * 100}%`,
    position: `${col / (sheet.cols - 1) * 100}% ${row / (sheet.rows - 1) * 100}%`
  };
}

function render() {
  document.getElementById('playerHpFill').style.width = `${(playerCastleHP / CASTLE_MAX_HP) * 100}%`;
  document.getElementById('enemyHpFill').style.width = `${(computerCastleHP / CASTLE_MAX_HP) * 100}%`;
  document.getElementById('playerHpText').textContent = `${playerCastleHP}/${CASTLE_MAX_HP}`;
  document.getElementById('enemyHpText').textContent = `${computerCastleHP}/${CASTLE_MAX_HP}`;

  renderCastle('playerCastleGraphic', 'playerCastleImg', 'player', playerCastleHP);
  renderCastle('enemyCastleGraphic', 'enemyCastleImg', 'computer', computerCastleHP);

  document.getElementById('battleTimer').textContent = formatDuration(battleElapsedMs);

  renderSoldiers();
  renderFog();
  updateCoinsDisplay();
}

// ---------- Fog of war (see SOLDIER_SIGHT etc. in config.js) ----------
// What the player can currently see: circles around their castle and every
// living soldier of theirs. Recomputed from scratch each time, so a place
// falls back into fog the moment nobody's near it.
function playerSightCircles() {
  const circles = [{ x: PLAYER_CASTLE_POS.x, y: PLAYER_CASTLE_POS.y, r: CASTLE_SIGHT }];
  for (const s of soldiers) {
    if (s.side === 'player' && !s.dying) circles.push({ x: s.x, y: s.y, r: SOLDIER_SIGHT });
  }
  return circles;
}

function isSeenByPlayer(x, y, circles) {
  return circles.some(c => Math.hypot(x - c.x, y - c.y) <= c.r);
}

// A <canvas> laid over the whole board: filled with fog, then each sight
// circle is "erased" out of it with a soft-edged gradient. Canvas rather
// than DOM elements because erasing overlapping holes out of one layer is
// exactly what canvas's 'destination-out' mode does, and it's cheap to
// redraw every frame. Kept at the board's real pixel size (x devicePixelRatio
// for a sharp edge), resized whenever the board's size changes.
function renderFog() {
  const canvas = document.getElementById('fogCanvas');
  const plane = document.getElementById('battlefieldPlane');
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(plane.clientWidth * dpr);
  const h = Math.round(plane.clientHeight * dpr);
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  const pxPerUnit = w / WORLD_W; // same vertically: the board keeps the world's aspect ratio
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = FOG_COLOR;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'destination-out';
  for (const c of playerSightCircles()) {
    const cx = c.x * pxPerUnit;
    const cy = c.y * pxPerUnit;
    const r = c.r * pxPerUnit;
    const g = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
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
  const sight = playerSightCircles();

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
      const fig = document.createElement('div');
      fig.className = 'soldier-figure';
      wrap.appendChild(hpBar);
      wrap.appendChild(fig);
      soldiersLayer.appendChild(wrap);
      refs = { wrap, hpFill, fig, frameKey: '' };
      soldierElements.set(s.id, refs);
    }

    const sideClass = s.side === 'player' ? 'player' : 'enemy';
    refs.wrap.className = `soldier ${sideClass} ${s.pose}`
      + (s.faceLeft ? ' face-left' : '')
      + (selectedIds.has(s.id) ? ' selected' : '');
    refs.wrap.style.left = `${s.x / WORLD_W * 100}%`;
    refs.wrap.style.top = `${s.y / WORLD_H * 100}%`;
    // Feet further down the board = closer to the viewer = drawn on top.
    refs.wrap.style.zIndex = Math.round(s.y * 10);
    // Fog of war: enemy soldiers (alive or fallen) only show inside the
    // player's current sight.
    const hidden = s.side !== 'player' && !isSeenByPlayer(s.x, s.y, sight);
    refs.wrap.style.visibility = hidden ? 'hidden' : '';

    refs.hpFill.style.width = `${Math.max(0, s.hp) / SOLDIER_HP * 100}%`;

    // Only touch the background when the frame actually changed, so the
    // browser isn't asked to repaint the same frame every tick.
    const frameKey = `${s.anim}:${s.frameIndex}`;
    if (refs.frameKey !== frameKey) {
      refs.frameKey = frameKey;
      const f = soldierFrameStyle(s);
      refs.fig.style.backgroundImage = f.image;
      refs.fig.style.backgroundSize = f.size;
      refs.fig.style.backgroundPosition = f.position;
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

// Sizes the board from config.js: WORLD_W/VIEW_W screens wide (the rest is
// scrolled to), with the world's own aspect ratio so a unit is square.
// --world-w lets style.css size soldiers/castles/markers in board units.
// Then puts each castle graphic's base-center on its board position
// (PLAYER_CASTLE_POS/COMPUTER_CASTLE_POS), so the art and the siege logic
// (castleDistance(), combat.js) share one source of truth, and lays out the
// scenery (SCENERY, config.js) once.
function placeBoard() {
  const plane = document.getElementById('battlefieldPlane');
  plane.style.width = `${WORLD_W / VIEW_W * 100}%`;
  plane.style.aspectRatio = `${WORLD_W} / ${WORLD_H}`;
  plane.style.setProperty('--world-w', WORLD_W);

  const placeAt = (el, pos) => {
    el.style.left = `${pos.x / WORLD_W * 100}%`;
    el.style.top = `${pos.y / WORLD_H * 100}%`;
    el.style.zIndex = Math.round(pos.y * 10); // same depth sorting as soldiers
  };
  placeAt(document.getElementById('playerCastleGraphic'), PLAYER_CASTLE_POS);
  placeAt(document.getElementById('enemyCastleGraphic'), COMPUTER_CASTLE_POS);

  const layer = document.getElementById('sceneryLayer');
  if (layer.childElementCount) return; // scenery never changes; built on the first game only
  SCENERY.forEach((item, i) => {
    const art = SCENERY_ART[item.art];
    const el = document.createElement('div');
    el.className = `scenery scenery-${item.art}`;
    el.style.width = `calc(100% * ${art.w} / var(--world-w))`;
    el.style.backgroundImage = `url('${art.src}')`;
    el.style.transform = `translate(-50%, -${art.baseY * 100}%)`;
    // Swaying trees (4-frame row of a sheet): stagger them so they don't sway in unison.
    if (art.sheetCols) el.style.animationDelay = `${-(i * 0.37) % 1.2}s`;
    placeAt(el, item);
    layer.appendChild(el);
  });
}
