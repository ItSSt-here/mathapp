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
  const modeLabels = { fractions: 'שברים', comparefractions: 'השוואת שברים', letters: 'אותיות', abc: 'ABC', nikud: 'ניקוד' };
  const modeLabel = modeLabels[gameMode] || 'כפל';
  return `נושא: ${modeLabel} | מהירות: ${DIFFICULTIES[difficultyIndex]} | קושי תרגילים: ${EXERCISE_DIFFICULTIES[exerciseDifficultyIndex]}`;
}

// ---------- Teacher link: URL config parsing + share-link generation ----------
function parseUrlParams() {
  const params = new URLSearchParams(location.search);
  const topic = params.get(URL_PARAM_TOPIC);
  const difficultyNum = Number(params.get(URL_PARAM_DIFFICULTY));
  if (!VALID_TOPICS.includes(topic)) return false;
  if (!Number.isInteger(difficultyNum) || difficultyNum < 1 || difficultyNum > EXERCISE_DIFFICULTIES.length) return false;
  gameMode = topic;
  // Clamped rather than rejected: an older link generated before a topic's
  // level count shrank (see EXERCISE_TOPIC_LEVEL_COUNTS in config.js) should
  // still auto-start the game instead of dumping the student back at the
  // mode-select screen -- and for every topic shrunk so far, the removed
  // levels were exact duplicates of a lower one anyway, so clamping produces
  // identical gameplay to what the link originally pointed at.
  exerciseDifficultyIndex = Math.min(difficultyNum, getExerciseLevelCount()) - 1;
  arrivedViaLink = true;
  return true;
}

function showInitialOverlay() {
  const viaLink = parseUrlParams();
  document.getElementById(viaLink ? 'startOverlay' : 'modeOverlay').classList.add('show');
}

function applyLinkModeUI() {
  document.getElementById('backToLinkBtn').style.display = arrivedViaLink ? 'none' : '';
  document.getElementById('reconfigureBtn').style.display = arrivedViaLink ? 'none' : '';
}

function buildShareLink() {
  const params = new URLSearchParams();
  params.set(URL_PARAM_TOPIC, gameMode);
  params.set(URL_PARAM_DIFFICULTY, String(exerciseDifficultyIndex + 1));
  // location.origin is the literal string "null" when the page is opened
  // directly as a file:// URL (no local server) -- protocol+host stays
  // correct in that case (host is just empty) so building from those
  // instead keeps the link usable while testing locally that way too.
  return `${location.protocol}//${location.host}${location.pathname}?${params.toString()}`;
}

function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  const feedback = document.getElementById('copyFeedback');
  const showCopied = () => {
    feedback.textContent = 'הועתק!';
    setTimeout(() => { feedback.textContent = ''; }, 2000);
  };
  const legacyCopy = () => {
    input.select();
    document.execCommand('copy'); // works over file:// where navigator.clipboard is unavailable
    showCopied();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(showCopied).catch(legacyCopy);
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
function placeBattlefield() {
  const castleRow = document.getElementById('castleRow');
  const isMobile = window.matchMedia('(max-width: 600px)').matches;
  if (isMobile) {
    document.querySelector('.card').prepend(castleRow);
  } else {
    document.getElementById('castleRowDesktopAnchor').after(castleRow);
  }
}

// ---------- Events ----------
document.getElementById('checkBtn').addEventListener('click', checkAnswer);
document.getElementById('answer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkAnswer();
});
document.getElementById('answer').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
  // Full-reduction fraction exercises (both numerator and denominator
  // blank) always target a single digit each, so one digit reliably means
  // "done with this box" -- jump to the other one instead of making the
  // student reach for it themselves.
  if (typeof currentAnswer === 'object' && e.target.value.length === 1) {
    document.getElementById('answer2').focus();
  }
});
document.getElementById('answer2').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkAnswer();
});
document.getElementById('answer2').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
  if (typeof currentAnswer === 'object' && e.target.value.length === 1) {
    document.getElementById('answer').focus();
  }
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
  document.getElementById('shareLinkRow').classList.remove('show');
  document.getElementById('exDifficultyOverlay').classList.remove('show');
  document.getElementById('linkOverlay').classList.add('show');
});
document.getElementById('backToExDiffBtn').addEventListener('click', () => {
  document.getElementById('linkOverlay').classList.remove('show');
  document.getElementById('exDifficultyOverlay').classList.add('show');
});
document.getElementById('teacherContinueBtn').addEventListener('click', () => {
  document.getElementById('linkOverlay').classList.remove('show');
  document.getElementById('startOverlay').classList.add('show');
});
document.getElementById('createLinkBtn').addEventListener('click', () => {
  document.getElementById('shareLinkInput').value = buildShareLink();
  document.getElementById('shareLinkRow').classList.add('show');
});
document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
document.getElementById('backToLinkBtn').addEventListener('click', () => {
  document.getElementById('startOverlay').classList.remove('show');
  document.getElementById('linkOverlay').classList.add('show');
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
