// ---------- Difficulty pickers, game start/end, and event wiring ----------
function updateDifficultyLabel() {
  document.getElementById('diffLabel').textContent = DIFFICULTIES[difficultyIndex];
  document.getElementById('diffDownBtn').disabled = difficultyIndex === 0;
  document.getElementById('diffUpBtn').disabled = difficultyIndex === DIFFICULTIES.length - 1;
}

function changeDifficulty(delta) {
  const next = difficultyIndex + delta;
  if (next < 0 || next >= DIFFICULTIES.length) return;
  difficultyIndex = next;
  updateDifficultyLabel();
}

function updateExerciseDifficultyLabel() {
  document.getElementById('exDiffLabel').textContent = EXERCISE_DIFFICULTIES[exerciseDifficultyIndex];
  document.getElementById('exDiffDownBtn').disabled = exerciseDifficultyIndex === 0;
  document.getElementById('exDiffUpBtn').disabled = exerciseDifficultyIndex === getExerciseLevelCount() - 1;
  const descriptions = EXERCISE_LEVEL_DESCRIPTIONS[gameMode];
  document.getElementById('exDiffDescription').textContent =
    descriptions ? descriptions[exerciseDifficultyIndex] : 'תיאור לנושא זה יתווסף בהמשך.';
}

function changeExerciseDifficulty(delta) {
  const next = exerciseDifficultyIndex + delta;
  if (next < 0 || next >= getExerciseLevelCount()) return;
  exerciseDifficultyIndex = next;
  updateExerciseDifficultyLabel();
}

function formatLevelInfo() {
  const modeLabels = { fractions: 'שברים', comparefractions: 'השוואת שברים', addfractions: 'חיבור שברים', subtractfractions: 'חיסור שברים', letters: 'אותיות', abc: 'ABC', nikud: 'ניקוד' };
  const modeLabel = modeLabels[gameMode] || 'כפל';
  return `נושא: ${modeLabel} | מהירות: ${DIFFICULTIES[difficultyIndex]} | קושי תרגילים: ${EXERCISE_DIFFICULTIES[exerciseDifficultyIndex]}`;
}

// ---------- Teacher link: URL config parsing + share-link generation ----------
// Returns which screen to land on -- see arrivedStage's comment in
// config.js for what each stage means and how it was decided.
function parseUrlParams() {
  const params = new URLSearchParams(location.search);
  const topic = params.get(URL_PARAM_TOPIC);
  if (!VALID_TOPICS.includes(topic)) return 'mode';
  gameMode = topic;

  const difficultyNum = Number(params.get(URL_PARAM_DIFFICULTY));
  const hasDifficulty = Number.isInteger(difficultyNum) && difficultyNum >= 1;
  // Clamped rather than rejected: an older link generated before a topic's
  // level count shrank (see EXERCISE_TOPIC_LEVEL_COUNTS in config.js) should
  // still work instead of dumping the student back at the mode-select
  // screen -- and for every topic shrunk so far, the removed levels were
  // exact duplicates of a lower one anyway, so clamping reproduces
  // identical gameplay to what the link originally pointed at.
  exerciseDifficultyIndex = hasDifficulty ? Math.min(difficultyNum, getExerciseLevelCount()) - 1 : 0;
  if (!hasDifficulty) return 'difficulty';

  const speedNum = Number(params.get(URL_PARAM_SPEED));
  const hasSpeed = Number.isInteger(speedNum) && speedNum >= 1 && speedNum <= DIFFICULTIES.length;
  if (!hasSpeed) return 'difficulty';
  difficultyIndex = speedNum - 1;
  return 'speed';
}

const ARRIVED_STAGE_OVERLAY = { mode: 'modeOverlay', difficulty: 'exDifficultyOverlay', speed: 'startOverlay' };

function showInitialOverlay() {
  arrivedStage = parseUrlParams();
  document.getElementById(ARRIVED_STAGE_OVERLAY[arrivedStage]).classList.add('show');
}

function applyLinkModeUI() {
  // Hide the escape hatch back to any screen whose choice got locked in by
  // the link the student arrived on -- 'difficulty'/'speed' both lock the
  // topic (hide the difficulty screen's "back to topics" button), and
  // 'speed' additionally locks the difficulty level (hide the speed
  // screen's "back to difficulty" button too).
  document.getElementById('backToModeBtn').style.display = arrivedStage === 'mode' ? '' : 'none';
  document.getElementById('backToLinkBtn').style.display = arrivedStage === 'speed' ? 'none' : '';
  document.getElementById('reconfigureBtn').style.display = arrivedStage === 'mode' ? '' : 'none';
}

// stage controls how much of the current selection gets baked into the
// link: 'mode' includes nothing (topic not chosen yet), 'difficulty'
// includes topic+difficulty (the difficulty screen's own "suggested
// starting level" for whoever opens it), 'speed' includes topic+difficulty
// +speed (the speed screen's "suggested starting speed"). See arrivedStage
// in config.js for how parseUrlParams() turns these back into a landing
// screen.
function buildShareLink(stage) {
  const params = new URLSearchParams();
  if (stage === 'difficulty' || stage === 'speed') {
    params.set(URL_PARAM_TOPIC, gameMode);
    params.set(URL_PARAM_DIFFICULTY, String(exerciseDifficultyIndex + 1));
  }
  if (stage === 'speed') {
    params.set(URL_PARAM_SPEED, String(difficultyIndex + 1));
  }
  const query = params.toString();
  // location.origin is the literal string "null" when the page is opened
  // directly as a file:// URL (no local server) -- protocol+host stays
  // correct in that case (host is just empty) so building from those
  // instead keeps the link usable while testing locally that way too.
  return `${location.protocol}//${location.host}${location.pathname}${query ? '?' + query : ''}`;
}

// feedbackEl gets a transient "הועתק!" confirmation. The legacy
// execCommand('copy') fallback (for file:// pages, where
// navigator.clipboard is unavailable) needs a real input to select from --
// shareLinkFallbackInput is a single shared, visually-hidden input kept
// just for that, since the link itself is never shown to the user anymore.
function copyShareLink(link, feedbackEl) {
  const showCopied = () => {
    feedbackEl.textContent = 'הועתק!';
    setTimeout(() => { feedbackEl.textContent = ''; }, 2000);
  };
  const legacyCopy = () => {
    const fallback = document.getElementById('shareLinkFallbackInput');
    fallback.value = link;
    fallback.select();
    document.execCommand('copy');
    showCopied();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(showCopied).catch(legacyCopy);
  } else {
    legacyCopy();
  }
}

function endGame(playerWon) {
  gameOver = true;
  clearInterval(intervalId);
  clearInterval(animIntervalId);
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlayTitle');
  title.textContent = playerWon ? '🏆 ניצחת!' : '💥 הפסדת';
  title.className = playerWon ? 'overlay-title win' : 'overlay-title lose';
  document.getElementById('overlayLevelInfo').textContent = formatLevelInfo();
  document.getElementById('overlayBattleTime').textContent = `משך הקרב: ${formatDuration(battleElapsedMs)}`;
  // correctCount/wrongCount/swapCount are frozen now that gameOver is true,
  // so a one-time copy into the overlay's own elements is enough -- no need
  // for these to live-update the way .top-stats-row does during play.
  document.getElementById('overlayCorrectCount').textContent = correctCount;
  document.getElementById('overlayWrongCount').textContent = wrongCount;
  document.getElementById('overlaySwapCount').textContent = swapCount;
  overlay.classList.add('show');
}

function startGame() {
  playerMoney = 0;
  playerCastleHP = CASTLE_MAX_HP;
  computerCastleHP = CASTLE_MAX_HP;
  soldiers = [];
  gameOver = false;
  enemySpawnTimer = 0;
  battleElapsedMs = 0;
  correctCount = 0;
  wrongCount = 0;
  swapCount = 0;
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('levelInfo').textContent = formatLevelInfo();
  recalcSiegeThresholds();

  if (swapTimeoutId) clearTimeout(swapTimeoutId);
  document.getElementById('checkBtn').disabled = false;
  document.getElementById('answer').disabled = false;
  document.getElementById('answer2').disabled = false;
  document.getElementById('swapBtn').disabled = false;

  updateCoinsDisplay();
  updateStatsCountersDisplay();
  render();
  newExercise();
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(tick, TICK_MS);
  if (animIntervalId) clearInterval(animIntervalId);
  animIntervalId = setInterval(animTick, ANIM_TICK_MS);
}

// ---------- Mobile layout: buy-soldier button placement ----------
// On a phone the on-screen keyboard covers roughly the bottom half of the
// viewport while typing an answer, so the desktop placement of "buy soldier"
// (down by the player's castle) ends up hidden behind it exactly when the
// player has coins to spend. Below the breakpoint, the same button element
// is moved up next to the exercise controls instead of duplicated, so there
// is still exactly one enabled/disabled state to keep in sync.
function placeBuyBtn() {
  const buyBtn = document.getElementById('buyBtn');
  const isMobile = window.matchMedia('(max-width: 600px)').matches;
  const target = document.getElementById(isMobile ? 'mobileBuyRow' : 'buyBtnDesktopHome');
  target.appendChild(buyBtn);
}

// On a phone, the on-screen keyboard covers the *bottom* of the screen, but
// nothing focuses/scrolls to keep the battlefield visible the way it does
// for the answer input -- so if the battlefield stays in its normal spot
// (below the exercise controls) it just gets hidden behind the keyboard
// while the player is typing. Moving it to the very top of the card avoids
// that regardless of how tall the keyboard is, at the cost of the title and
// exercise controls sitting below it instead of above.
//
// A CSS `order` class toggle instead of a DOM move (used to be
// `.prepend()`/`.after()`) -- see the .card/.castle-row-top comments in
// style.css for why: an early DOM mutation was a flagged-but-untested
// suspect for the Android overlay-positioning bug.
function placeBattlefield() {
  const isMobile = window.matchMedia('(max-width: 600px)').matches;
  document.getElementById('castleRow').classList.toggle('castle-row-top', isMobile);
}

// ---------- Events ----------
document.getElementById('checkBtn').addEventListener('click', checkAnswer);
// Two-blank exercises (currentAnswer is a {numerator, denominator} object)
// move focus to the other box on Enter instead of a digit-count guess --
// jumping once a box "looks full" would itself hint how many digits the
// real answer needs (e.g. whether addfractions level 2's reduced result
// came out one digit or two) before the student's even gotten it right.
// Enter only submits once both boxes actually have something in them.
document.getElementById('answer').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const answer2 = document.getElementById('answer2');
  if (typeof currentAnswer === 'object' && answer2.value.trim() === '') {
    answer2.focus();
    return;
  }
  checkAnswer();
});
document.getElementById('answer').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});
document.getElementById('answer2').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const answerInput = document.getElementById('answer');
  if (typeof currentAnswer === 'object' && answerInput.value.trim() === '') {
    answerInput.focus();
    return;
  }
  checkAnswer();
});
document.getElementById('answer2').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});
document.getElementById('buyBtn').addEventListener('click', () => {
  buySoldier();
  document.getElementById('answer').focus();
});
document.getElementById('swapBtn').addEventListener('click', changeQuestion);
document.getElementById('letterSoundBtn').addEventListener('click', () => {
  if (currentLetterAnswer) playCurrentTopicSound(currentLetterAnswer);
});
document.getElementById('surrenderBtn').addEventListener('click', () => {
  if (gameOver) return;
  endGame(false);
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
  startGame();
});
document.getElementById('changeDifficultyBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('startOverlay').classList.add('show');
});
document.getElementById('reconfigureBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('modeOverlay').classList.add('show');
});
// Each mode button just sets gameMode to its own topic string and advances
// to the difficulty picker -- looped over a table instead of one near-
// identical listener per button, so a future topic is a one-line entry here.
const MODE_BUTTON_TOPICS = {
  modeMultiplyBtn: 'multiplication',
  modeFractionsBtn: 'fractions',
  modeAddFractionsBtn: 'addfractions',
  modeSubtractFractionsBtn: 'subtractfractions',
  modeCompareFractionsBtn: 'comparefractions',
  modeLettersBtn: 'letters',
  modeAbcBtn: 'abc',
  modeNikudBtn: 'nikud',
};
for (const [btnId, topic] of Object.entries(MODE_BUTTON_TOPICS)) {
  document.getElementById(btnId).addEventListener('click', () => {
    gameMode = topic;
    // The previously-picked level can be out of range for the new topic
    // (e.g. coming from multiplication's 5 levels into letters' 2) --
    // clamp down instead of leaving it pointing past what this topic offers.
    exerciseDifficultyIndex = Math.min(exerciseDifficultyIndex, getExerciseLevelCount() - 1);
    updateExerciseDifficultyLabel();
    document.getElementById('modeOverlay').classList.remove('show');
    document.getElementById('exDifficultyOverlay').classList.add('show');
  });
}
document.getElementById('backToModeBtn').addEventListener('click', () => {
  document.getElementById('exDifficultyOverlay').classList.remove('show');
  document.getElementById('modeOverlay').classList.add('show');
});
document.getElementById('exDiffContinueBtn').addEventListener('click', () => {
  document.getElementById('exDifficultyOverlay').classList.remove('show');
  document.getElementById('startOverlay').classList.add('show');
});
document.getElementById('backToLinkBtn').addEventListener('click', () => {
  document.getElementById('startOverlay').classList.remove('show');
  document.getElementById('exDifficultyOverlay').classList.add('show');
});
document.getElementById('copyLinkModeBtn').addEventListener('click', () => {
  copyShareLink(buildShareLink('mode'), document.getElementById('copyFeedbackMode'));
});
document.getElementById('copyLinkDifficultyBtn').addEventListener('click', () => {
  copyShareLink(buildShareLink('difficulty'), document.getElementById('copyFeedbackDifficulty'));
});
document.getElementById('copyLinkSpeedBtn').addEventListener('click', () => {
  copyShareLink(buildShareLink('speed'), document.getElementById('copyFeedbackSpeed'));
});
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startOverlay').classList.remove('show');
  startGame();
});
document.getElementById('diffUpBtn').addEventListener('click', () => changeDifficulty(1));
document.getElementById('diffDownBtn').addEventListener('click', () => changeDifficulty(-1));
document.getElementById('exDiffUpBtn').addEventListener('click', () => changeExerciseDifficulty(1));
document.getElementById('exDiffDownBtn').addEventListener('click', () => changeExerciseDifficulty(-1));
window.addEventListener('resize', recalcSiegeThresholds);
window.addEventListener('resize', placeBuyBtn);
window.addEventListener('resize', placeBattlefield);
showInitialOverlay();
applyLinkModeUI();
updateDifficultyLabel();
updateExerciseDifficultyLabel();
placeBuyBtn();
placeBattlefield();
preloadSoldierSprites();
preloadCastleSprites();
