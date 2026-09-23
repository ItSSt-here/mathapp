// ---------- PvP match sync: host runs the battle, guest mirrors it ----------
// See [[project_pvp_plan]] in memory; the database channels are in net.js.
//
// One of the two browsers -- the room's config.host, drawn at random by the
// teacher's screen -- is the HOST: it runs the real battle (tick(),
// combat.js) exactly like a normal game, applies the other student's
// commands as they arrive, and after every tick publishes the whole battle
// (encodeState()) to the room. The other browser is the GUEST: it never
// runs tick() -- it sends its commands to the host and draws whatever
// state the host last published. Only sprite animation frames run locally
// on the guest (animTick()), since they're pure decoration.
//
// Fairness: the guest sees the result of its own command only after it
// travelled to the host and the next state travelled back, i.e. about two
// one-way lags. The host measures that lag on every guest command and
// holds back its OWN commands by the same amount (hostCommandDelayMs()), so
// neither student gets faster reactions for being the host.
//
// Resilience: each published state is complete (every soldier's order,
// home, cooldowns, the mines, both teams' coins, and the last guest command
// already applied), so a host that reloads mid-match picks the battle up
// from it and replays whatever guest commands came after. If either student
// drops out, the host pauses the battle until they're back; after
// PVP_FORFEIT_AFTER_MS the one still there can claim the win.

let matchPaused = false;    // host: opponent offline -> tick() does nothing
let lastCmdKey = null;      // host: push key of the last guest command applied
let guestLagMs = 150;       // host: smoothed one-way lag of guest commands
let pvpResultShown = false;
let pvpPauseSince = null;
let pvpPauseTimer = null;
const PVP_FORFEIT_AFTER_MS = 60000;
const MAX_HOST_DELAY_MS = 400;

function isPvpHost() {
  return matchMode === 'pvp' && !!matchConfig && (matchConfig.host || 'player') === localSide;
}

function isPvpGuest() {
  return matchMode === 'pvp' && !isPvpHost();
}

function hostCommandDelayMs() {
  return Math.min(MAX_HOST_DELAY_MS, Math.max(0, 2 * guestLagMs));
}

// ---------- State encoding ----------
// Compact on purpose (the guest downloads this 4 times a second): one small
// array per soldier instead of an object with field names, 2-decimal
// positions, and short codes for the few string fields.
const SIDE_CODES = ['player', 'computer', 'neutral'];
const ROLE_CODES = ['player', 'guard', 'raider', 'mineGuard', 'mineKeeper'];
const DIR_CODES = ['side', 'up', 'down'];
const round2 = v => Math.round(v * 100) / 100;
const codeOf = (codes, v) => (v == null ? -1 : codes.indexOf(v));

function encodeSoldier(s) {
  return [
    s.id, codeOf(SIDE_CODES, s.side), codeOf(ROLE_CODES, s.role), round2(s.x), round2(s.y), s.hp,
    (s.faceLeft ? 1 : 0) | (s.attacking ? 2 : 0) | (s.moving ? 4 : 0) | (s.dying ? 8 : 0),
    codeOf(DIR_CODES, s.attackDir), s.facingDeg, s.atkCooldown, s.dying ? s.deathTimer : 0,
    s.order ? [round2(s.order.x), round2(s.order.y), s.order.castle ? 1 : 0] : 0,
    s.home ? [round2(s.home.x), round2(s.home.y)] : 0,
    s.leash || 0, s.mineId == null ? -1 : s.mineId, s.plateauLevel || 0
  ];
}

// Updates `prev` (the same soldier's object from the last state, if any) in
// place, so its animation frame carries on smoothly unless the animation
// itself changed.
function decodeSoldier(a, prev) {
  const [id, side, role, x, y, hp, flags, dir, facingDeg, atkCooldown, deathTimer,
         order, home, leash, mineId, plateauLevel] = a;
  const s = prev || { id, frameIndex: 0 };
  Object.assign(s, {
    id, side: SIDE_CODES[side], role: ROLE_CODES[role], x, y, hp,
    faceLeft: !!(flags & 1), attacking: !!(flags & 2), moving: !!(flags & 4), dying: !!(flags & 8),
    attackDir: DIR_CODES[dir] || 'side', facingDeg, atkCooldown, deathTimer,
    order: order ? { x: order[0], y: order[1], ...(order[2] ? { castle: true } : {}) } : null,
    home: home ? { x: home[0], y: home[1] } : null,
    leash: leash || null,
    path: null
  });
  if (mineId >= 0) s.mineId = mineId; else delete s.mineId;
  if (plateauLevel) s.plateauLevel = plateauLevel; else delete s.plateauLevel;
  s.pose = s.dying ? 'dying' : (s.attacking ? 'attacking' : (s.moving ? 'walking' : 'idle'));
  const anim = soldierAnimKey(s);
  if (anim !== s.anim) { s.anim = anim; s.frameIndex = 0; }
  return s;
}

function encodeState() {
  return JSON.stringify({
    el: battleElapsedMs,
    hp: [playerCastleHP, computerCastleHP],
    m: [sides.player.money, sides.computer.money],
    n: soldierId,
    lc: lastCmdKey || '',
    mines: mines.map(m => [codeOf(SIDE_CODES, m.owner), codeOf(SIDE_CODES, m.captureSide), m.captureMs]),
    s: soldiers.map(encodeSoldier)
  });
}

// Puts a published state into the game's own globals. `resume` = the host
// taking over from a saved state after a reload (also restores the id
// counter and where to continue reading guest commands).
function applyState(st, resume) {
  battleElapsedMs = st.el;
  playerCastleHP = st.hp[0];
  computerCastleHP = st.hp[1];
  sides.player.money = st.m[0];
  sides.computer.money = st.m[1];
  st.mines.forEach((a, i) => {
    const m = mines[i];
    if (!m) return;
    m.owner = a[0] < 0 ? null : SIDE_CODES[a[0]];
    m.captureSide = a[1] < 0 ? null : SIDE_CODES[a[1]];
    m.captureMs = a[2];
  });
  const prev = new Map(soldiers.map(s => [s.id, s]));
  soldiers = st.s.map(a => decodeSoldier(a, prev.get(a[0])));
  if (resume) {
    soldierId = st.n;
    lastCmdKey = st.lc || null;
  }
  // Selected soldiers that died (or are gone) drop out of the selection.
  for (const id of [...selectedIds]) {
    const s = soldiers.find(x => x.id === id);
    if (!s || s.dying) selectedIds.delete(id);
  }
  render();
}

// ---------- Running the match ----------
// Called when the countdown ends, or right away when rejoining a match
// already under way (resumeState = the host's last published state).
function beginPvpMatch(resumeState) {
  pvpStarted = true;
  document.getElementById('pvpLobbyOverlay').classList.remove('show');
  startGame();
  if (isPvpHost()) {
    if (resumeState) applyState(JSON.parse(resumeState), true);
    roomSession.listenCommands(enemyOf(localSide), lastCmdKey, (key, cmd, sentAt) => {
      lastCmdKey = key;
      const lag = serverNow() - sentAt;
      if (lag >= 0 && lag < 5000) guestLagMs = guestLagMs * 0.8 + lag * 0.2;
      applyCommand(enemyOf(localSide), cmd);
    });
  } else {
    // The guest doesn't simulate -- it only draws the host's states.
    clearInterval(intervalId);
    intervalId = null;
    roomSession.listenState(json => {
      if (!gameOver) applyState(JSON.parse(json), false);
    });
  }
  roomSession.listenResult(showPvpResult);
}

// Host, after every tick (combat.js).
function publishPvpState() {
  roomSession.publishState(encodeState());
}

// The match is decided (castle fell, surrender, or a forfeit claim): record
// it once in the room; both browsers show it when it arrives
// (showPvpResult). The battle stops here right away.
function reportPvpResult(winnerSide, surrendered, forfeit) {
  if (isPvpHost()) publishPvpState(); // the final picture of the battle
  gameOver = true;
  roomSession.writeResult({ winner: winnerSide, surrendered: !!surrendered, forfeit: !!forfeit });
}

function showPvpResult(result) {
  if (pvpResultShown) return;
  pvpResultShown = true;
  hidePvpPause();
  endGame(result.winner === localSide, result.surrendered);
}

// ---------- Opponent dropped out ----------
// Called with the seats on every lobby/seat change once the match runs.
function updatePvpPresence(seats) {
  if (pvpResultShown) return;
  const opponent = seats[enemyOf(localSide)];
  const away = !opponent || !opponent.online;
  matchPaused = away && isPvpHost();
  if (away && pvpPauseSince == null) {
    pvpPauseSince = Date.now();
    document.getElementById('pvpPauseBanner').classList.add('show');
    pvpPauseTimer = setInterval(refreshPvpPause, 500);
    refreshPvpPause();
  } else if (!away && pvpPauseSince != null) {
    hidePvpPause();
  }
}

function refreshPvpPause() {
  const left = Math.ceil((PVP_FORFEIT_AFTER_MS - (Date.now() - pvpPauseSince)) / 1000);
  document.getElementById('pvpPauseText').textContent = left > 0
    ? `⏸ היריב התנתק -- המשחק בהמתנה עד שיחזור (${left})`
    : '⏸ היריב עדיין לא חזר';
  document.getElementById('pvpForfeitBtn').style.display = left > 0 ? 'none' : '';
}

function hidePvpPause() {
  pvpPauseSince = null;
  clearInterval(pvpPauseTimer);
  document.getElementById('pvpPauseBanner').classList.remove('show');
}

document.getElementById('pvpForfeitBtn').addEventListener('click', () => {
  if (pvpPauseSince == null || gameOver) return;
  reportPvpResult(localSide, false, true);
});
