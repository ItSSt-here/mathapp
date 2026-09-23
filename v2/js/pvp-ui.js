// ---------- PvP screens: teacher setup, the two links, the student lobby ----------
// See [[project_pvp_plan]] in memory and net.js for the database side.
//
// Flow: a bare v2 link opens matchTypeOverlay ("against the computer" -> the
// usual topic screens; "PvP" -> pvpSetupOverlay). The teacher fills in each
// team's settings, "צור משחק" stores them as a new room (createRoom(),
// net.js) and pvpLinksOverlay shows one link per team. A student opening
// their link lands in pvpLobbyOverlay (openPvpLobby()).

// Topics offered for PvP: everything except vocabulary and grammar, which
// need a teacher-supplied word list (can be added later).
const PVP_TOPICS = ['multiplication', 'division', ...FRACTIONS_GROUP_TOPICS,
  'letters', 'abc', 'nikud', ...DECIMALS_GROUP_TOPICS];

// The number settings of each team, in form order: [key, label, min].
const PVP_NUMBER_FIELDS = [
  ['soldierCost', 'מחיר חייל', 1],
  ['correctReward', 'מטבעות על תשובה נכונה', 0],
  ['mineBonus', 'תוספת לכל מכרה', 0],
  ['wrongPenalty', 'קנס על טעות', 0],
  ['swapCost', 'מחיר החלפת שאלה', 0]
];

function topicLabel(topic) {
  return topic === 'multiplication' ? 'לוח הכפל' : MODE_LABELS[topic];
}

// The settings every new PvP form starts from: the classic game's values,
// multiplication at the level the normal game defaults to.
function defaultPvpSideConfig() {
  return {
    topic: 'multiplication',
    level: 1,
    review: true,
    ...defaultSideParams()
  };
}

// ---------- Teacher: the settings form ----------
// One column per team, built from the same code so both always have the
// same fields. Element ids are `pvp-<team>-<key>`.
function pvpField(team, key) {
  return document.getElementById(`pvp-${team}-${key}`);
}

function buildPvpColumn(team) {
  const col = document.getElementById(`pvpColumn-${team}`);
  const d = defaultPvpSideConfig();
  const topicOptions = PVP_TOPICS.map(t => `<option value="${t}">${topicLabel(t)}</option>`).join('');
  const numberRows = PVP_NUMBER_FIELDS.map(([key, label, min]) => `
    <label class="pvp-row" id="pvp-${team}-${key}-row">
      <span>${label}</span>
      <input type="number" id="pvp-${team}-${key}" min="${min}" max="${MAX_COINS}" step="1" value="${d[key]}">
    </label>`).join('');
  col.innerHTML = `
    <div class="pvp-column-title">${team === 'player' ? '🔵 הצד הכחול' : '🔴 הצד האדום'}</div>
    <label class="pvp-row"><span>נושא</span><select id="pvp-${team}-topic">${topicOptions}</select></label>
    <label class="pvp-row"><span>רמה</span><select id="pvp-${team}-level"></select></label>
    <div class="pvp-level-description" id="pvp-${team}-levelDescription"></div>
    <label class="pvp-row pvp-check"><span>לחזור על שאלות שטעו בהן</span><input type="checkbox" id="pvp-${team}-review" checked></label>
    <label class="pvp-row pvp-check"><span>לאפשר החלפת שאלה</span><input type="checkbox" id="pvp-${team}-swapAllowed" checked></label>
    ${numberRows}`;
  pvpField(team, 'topic').value = d.topic;
  fillPvpLevels(team, d.level);
}

// Level choices depend on the topic (EXERCISE_TOPIC_LEVEL_COUNTS); keeps the
// chosen level if the new topic has it, else its last level.
function fillPvpLevels(team, wanted) {
  const topic = pvpField(team, 'topic').value;
  const count = EXERCISE_TOPIC_LEVEL_COUNTS[topic] || EXERCISE_DIFFICULTIES.length;
  const select = pvpField(team, 'level');
  select.innerHTML = Array.from({ length: count }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  select.value = String(Math.min(wanted, count));
  updatePvpLevelDescription(team);
}

function updatePvpLevelDescription(team) {
  const descriptions = EXERCISE_LEVEL_DESCRIPTIONS[pvpField(team, 'topic').value];
  const level = Number(pvpField(team, 'level').value);
  document.getElementById(`pvp-${team}-levelDescription`).textContent = descriptions ? descriptions[level - 1] : '';
}

function readPvpColumn(team) {
  const cfg = {
    topic: pvpField(team, 'topic').value,
    level: Number(pvpField(team, 'level').value),
    review: pvpField(team, 'review').checked,
    swapAllowed: pvpField(team, 'swapAllowed').checked
  };
  for (const [key, , min] of PVP_NUMBER_FIELDS) {
    const n = Math.round(Number(pvpField(team, key).value));
    cfg[key] = Number.isFinite(n) ? Math.max(min, Math.min(MAX_COINS, n)) : defaultSideParams()[key];
  }
  return cfg;
}

function writePvpColumn(team, cfg) {
  pvpField(team, 'topic').value = cfg.topic;
  fillPvpLevels(team, cfg.level);
  pvpField(team, 'review').checked = cfg.review;
  pvpField(team, 'swapAllowed').checked = cfg.swapAllowed;
  for (const [key] of PVP_NUMBER_FIELDS) pvpField(team, key).value = cfg[key];
  refreshPvpColumnState(team);
}

// The swap cost only matters while swapping is allowed.
function refreshPvpColumnState(team) {
  const allowed = pvpField(team, 'swapAllowed').checked;
  pvpField(team, 'swapCost').disabled = !allowed || (team === 'computer' && pvpSameSettings());
  document.getElementById(`pvp-${team}-swapCost-row`).classList.toggle('pvp-disabled', !allowed);
}

function pvpSameSettings() {
  return document.getElementById('pvpSameSettings').checked;
}

// "Same settings for both teams": red's column mirrors blue's and can't be
// edited; unticking it keeps the copied values as a starting point.
function syncPvpRedColumn() {
  const same = pvpSameSettings();
  const col = document.getElementById('pvpColumn-computer');
  col.classList.toggle('pvp-locked', same);
  if (same) writePvpColumn('computer', readPvpColumn('player'));
  for (const el of col.querySelectorAll('input, select')) el.disabled = same;
  refreshPvpColumnState('computer');
}

function onPvpColumnChange(team, e) {
  if (e.target.id === `pvp-${team}-topic`) fillPvpLevels(team, Number(pvpField(team, 'level').value));
  if (e.target.id === `pvp-${team}-level`) updatePvpLevelDescription(team);
  refreshPvpColumnState(team);
  if (team === 'player' && pvpSameSettings()) syncPvpRedColumn();
}

function openPvpSetup() {
  if (!document.getElementById('pvpColumn-player').childElementCount) {
    for (const team of ['player', 'computer']) {
      buildPvpColumn(team);
      const col = document.getElementById(`pvpColumn-${team}`);
      col.addEventListener('change', (e) => onPvpColumnChange(team, e));
      col.addEventListener('input', (e) => { if (e.target.type === 'number') onPvpColumnChange(team, e); });
    }
    syncPvpRedColumn();
  }
  document.getElementById('pvpSetupStatus').textContent = '';
  document.getElementById('pvpSetupOverlay').classList.add('show');
}

async function onPvpCreate() {
  const btn = document.getElementById('pvpCreateBtn');
  const status = document.getElementById('pvpSetupStatus');
  const config = { player: readPvpColumn('player'), computer: readPvpColumn(pvpSameSettings() ? 'player' : 'computer') };
  btn.disabled = true;
  status.textContent = 'יוצר משחק...';
  try {
    const roomId = await createRoom(config);
    document.getElementById('pvpLinkBlue').value = buildRoomLink(roomId, 'player');
    document.getElementById('pvpLinkRed').value = buildRoomLink(roomId, 'computer');
    status.textContent = '';
    document.getElementById('pvpSetupOverlay').classList.remove('show');
    document.getElementById('pvpLinksOverlay').classList.add('show');
  } catch (err) {
    console.error(err);
    status.textContent = 'לא הצלחנו ליצור את המשחק. בדקו את החיבור לאינטרנט ונסו שוב.';
  } finally {
    btn.disabled = false;
  }
}

// ---------- Student: arriving on a room link ----------
// Takes this link's team, loads the room's settings, and applies this
// team's topic/level/review to the exercises (the same globals the normal
// topic screens set), then sits down in the room's lobby (joinRoom(),
// net.js): each student presses "מוכן", and once both are ready both
// browsers count down PVP_COUNTDOWN_MS to the same server-clock moment and
// start the match.
let matchConfig = null; // the room's {player, computer} settings once loaded
let roomSession = null; // joinRoom()'s handle while in a room
let pvpCountdownTimer = null;
let pvpStarted = false;
const PVP_COUNTDOWN_MS = 3000;
// A room whose start was longer ago than this is a match already under
// way (e.g. the page was refreshed mid-game) -- rejoining one comes later.
const PVP_LATE_JOIN_MS = 10000;

async function openPvpLobby(params) {
  const team = URL_SIDE_TO_TEAM[params.get(URL_PARAM_SIDE)];
  const roomId = params.get(URL_PARAM_ROOM);
  const title = document.getElementById('pvpLobbyTitle');
  const info = document.getElementById('pvpLobbyInfo');
  document.getElementById('pvpLobbyOverlay').classList.add('show');
  if (!team || !/^[a-z0-9]{6,20}$/.test(roomId)) {
    title.textContent = 'הקישור לא תקין';
    info.textContent = 'בקשו מהמורה את הקישור שוב.';
    return;
  }
  matchMode = 'pvp';
  localSide = team;
  title.textContent = 'מתחבר למשחק...';
  try {
    matchConfig = await fetchRoomConfig(roomId);
  } catch (err) {
    console.error(err);
    title.textContent = 'אין חיבור';
    info.textContent = 'לא הצלחנו להתחבר. בדקו את החיבור לאינטרנט ורעננו את הדף.';
    return;
  }
  if (!matchConfig) {
    title.textContent = 'המשחק לא נמצא';
    info.textContent = 'ייתכן שהקישור שגוי. בקשו מהמורה את הקישור שוב.';
    return;
  }
  const mine = matchConfig[team];
  gameMode = mine.topic;
  exerciseDifficultyIndex = Math.min(mine.level, getExerciseLevelCount()) - 1;
  weakPoolReviewEnabled = mine.review;
  const box = document.getElementById('pvpLobbyOverlay').querySelector('.overlay-card');
  box.classList.remove('side-player', 'side-computer');
  box.classList.add(`side-${team}`);
  title.textContent = team === 'player' ? 'אתה בצד הכחול 🔵' : 'אתה בצד האדום 🔴';
  info.textContent = `נושא: ${topicLabel(mine.topic)} · רמה ${mine.level}`;

  try {
    roomSession = await joinRoom(roomId, team, onRoomUpdate);
  } catch (err) {
    console.error(err);
    title.textContent = err.code === 'SEAT_TAKEN' ? 'הצד הזה כבר תפוס' : 'אין חיבור';
    info.textContent = err.code === 'SEAT_TAKEN'
      ? 'מישהו אחר כבר מחובר לצד הזה. בדקו שפתחתם את הקישור הנכון.'
      : 'לא הצלחנו להתחבר. בדקו את החיבור לאינטרנט ורעננו את הדף.';
    return;
  }
  const readyBtn = document.getElementById('pvpReadyBtn');
  readyBtn.style.display = '';
  readyBtn.disabled = false;
}

// Every change in the room (either student connecting, leaving, getting
// ready, or the start moment being set) redraws the lobby from scratch.
function onRoomUpdate(room) {
  if (!room || pvpStarted) return;
  const seats = room.seats || {};
  for (const team of ['player', 'computer']) {
    const seat = seats[team];
    const mine = team === localSide;
    const name = team === 'player' ? '🔵 כחול' : '🔴 אדום';
    const state = !seat || !seat.online ? 'ממתין שיתחבר...'
      : (seat.ready ? 'מוכן ✔' : 'מחובר, עוד לא מוכן');
    const el = document.getElementById(`pvpSeat-${team}`);
    el.textContent = `${name}${mine ? ' (אתה)' : ''}: ${state}`;
    el.classList.toggle('ready', !!(seat && seat.online && seat.ready));
  }

  const myReady = !!(seats[localSide] && seats[localSide].ready);
  const readyBtn = document.getElementById('pvpReadyBtn');
  readyBtn.textContent = myReady ? 'לא מוכן עדיין' : 'מוכן! ✋';
  readyBtn.classList.toggle('is-ready', myReady);

  const bothReady = ['player', 'computer'].every(t => seats[t] && seats[t].online && seats[t].ready);
  if (room.startAt) {
    if (serverNow() - room.startAt > PVP_LATE_JOIN_MS) {
      document.getElementById('pvpLobbyTitle').textContent = 'המשחק כבר התחיל';
      document.getElementById('pvpLobbyInfo').textContent = 'אי אפשר עדיין להצטרף באמצע משחק.';
      readyBtn.style.display = 'none';
      return;
    }
    startPvpCountdown(room.startAt + PVP_COUNTDOWN_MS);
  } else if (bothReady) {
    roomSession.requestStart();
  }
}

// Counts down to the shared start moment (server clock), then starts.
function startPvpCountdown(startServerMs) {
  if (pvpCountdownTimer) return;
  document.getElementById('pvpReadyBtn').style.display = 'none';
  const el = document.getElementById('pvpCountdown');
  const step = () => {
    const left = startServerMs - serverNow();
    if (left <= 0) {
      clearInterval(pvpCountdownTimer);
      pvpStarted = true;
      document.getElementById('pvpLobbyOverlay').classList.remove('show');
      startGame();
      return;
    }
    el.textContent = String(Math.ceil(left / 1000));
  };
  pvpCountdownTimer = setInterval(step, 50);
  step();
}

// ---------- Wiring ----------
document.getElementById('matchComputerBtn').addEventListener('click', () => {
  document.getElementById('matchTypeOverlay').classList.remove('show');
  document.getElementById('modeOverlay').classList.add('show');
});
document.getElementById('matchPvpBtn').addEventListener('click', () => {
  document.getElementById('matchTypeOverlay').classList.remove('show');
  openPvpSetup();
});
document.getElementById('pvpSameSettings').addEventListener('change', syncPvpRedColumn);
document.getElementById('pvpCreateBtn').addEventListener('click', onPvpCreate);
document.getElementById('pvpBackBtn').addEventListener('click', () => {
  document.getElementById('pvpSetupOverlay').classList.remove('show');
  document.getElementById('matchTypeOverlay').classList.add('show');
});
document.getElementById('pvpNewGameBtn').addEventListener('click', () => {
  document.getElementById('pvpLinksOverlay').classList.remove('show');
  openPvpSetup();
});
document.getElementById('pvpReadyBtn').addEventListener('click', () => {
  if (!roomSession) return;
  roomSession.setReady(!document.getElementById('pvpReadyBtn').classList.contains('is-ready'));
});
for (const [btnId, inputId, feedbackId] of [['pvpCopyBlueBtn', 'pvpLinkBlue', 'pvpCopyBlueFeedback'],
                                            ['pvpCopyRedBtn', 'pvpLinkRed', 'pvpCopyRedFeedback']]) {
  document.getElementById(btnId).addEventListener('click', () => {
    copyShareLink(document.getElementById(inputId).value, document.getElementById(feedbackId));
  });
}
