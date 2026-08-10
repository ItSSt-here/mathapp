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
  const modeLabels = { fractions: 'שברים', comparefractions: 'השוואת שברים', addfractions: 'חיבור שברים', subtractfractions: 'חיסור שברים', mixednumbers: 'מספרים מעורבים', letters: 'אותיות', abc: 'ABC', nikud: 'ניקוד' };
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
// Two-blank exercises (currentAnswer is a {numerator, denominator} object):
// Enter only ever moves forward (like Tab) or submits -- it never moves
// backward, and it does nothing at all while the box you're currently in is
// empty. That second part is deliberate, not just a nicety: a future
// exercise type needs one of these two boxes to be a legitimate blank
// answer, and if Enter could still fire while that box is empty, an
// absent-minded double Enter-press could submit a half-considered answer.
// Making Enter a no-op on an empty box closes that off -- the *only* way to
// leave a box blank on purpose is an explicit ArrowUp/ArrowDown move (or a
// click/tap), never a stray Enter, so Enter alone can never submit a box
// that was left empty by accident. Going back to fix a forgotten box is an
// arrow-key (or mouse) action only; Enter never does it, so a student can
// never be trained to expect Enter to send them backward.
// ArrowUp/ArrowDown move directly between the two boxes (they're stacked
// numerator-over-denominator in one .frac-block, so Up/Down matches what's
// on screen) -- fires unconditionally, regardless of cursor position. Unlike
// ArrowLeft/Right, a single-line text input has no native meaning for
// Up/Down at all (confirmed empirically -- pressing it doesn't even move the
// cursor to an edge first), so there's no in-box behavior to protect by
// gating on cursor position; gating here would only make the jump silently
// fail whenever the cursor wasn't already at the exact edge, e.g. after
// clicking into the middle of a two-digit value to fix it.
document.getElementById('answer').addEventListener('keydown', (e) => {
  const answer2 = document.getElementById('answer2');
  const isTwoBlank = typeof currentAnswer === 'object';
  // Mixed numbers is also a {whole, remainderNumerator} object, but its two
  // boxes sit side by side (whole box, then the fraction block) rather than
  // stacked -- see the ArrowRight/Left block below for its own nav instead.
  const isStackedTwoBlank = isTwoBlank && gameMode !== 'mixednumbers';
  if (e.key === 'ArrowDown' && isStackedTwoBlank) {
    e.preventDefault();
    answer2.focus();
    return;
  }
  // Mixed numbers: the whole box renders to the left of the fraction box in
  // this equation (.exercise/.frac-eq force direction:ltr regardless of the
  // page's own RTL, see style.css), so ArrowRight is "toward the fraction"
  // here -- only once the cursor's at the box's right edge (or the box is
  // empty), so normal in-box cursor movement isn't hijacked.
  if (e.key === 'ArrowRight' && gameMode === 'mixednumbers') {
    const atEnd = e.target.value === '' ||
      (e.target.selectionStart === e.target.value.length && e.target.selectionEnd === e.target.value.length);
    if (atEnd) {
      e.preventDefault();
      answer2.focus();
    }
    return;
  }
  if (e.key !== 'Enter') return;
  if (e.target.value.trim() === '') return; // no-op on an empty box -- never advances or submits
  if (isTwoBlank && answer2.value.trim() === '') {
    answer2.focus();
    return;
  }
  checkAnswer();
});
document.getElementById('answer').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});
// Mixed numbers only: the whole-number box is a legitimate blank (it
// asserts 0, see checkMixedNumberAnswer() in exercise-mixednumbers.js) --
// this is a purely visual affordance showing it was left blank on purpose,
// never a validity gate. Toggled on blur/focus rather than on every
// keystroke since it should only appear once the player has actually moved
// on from the box.
document.getElementById('answer').addEventListener('blur', (e) => {
  if (gameMode === 'mixednumbers' && e.target.value.trim() === '') {
    e.target.classList.add('answer-left-blank');
  }
});
document.getElementById('answer').addEventListener('focus', (e) => {
  e.target.classList.remove('answer-left-blank');
});
document.getElementById('answer2').addEventListener('keydown', (e) => {
  const answerInput = document.getElementById('answer');
  const isTwoBlank = typeof currentAnswer === 'object';
  const isStackedTwoBlank = isTwoBlank && gameMode !== 'mixednumbers';
  if (e.key === 'ArrowUp' && isStackedTwoBlank) {
    e.preventDefault();
    answerInput.focus();
    return;
  }
  if (e.key === 'ArrowLeft' && gameMode === 'mixednumbers') {
    const atStart = e.target.value === '' ||
      (e.target.selectionStart === 0 && e.target.selectionEnd === 0);
    if (atStart) {
      e.preventDefault();
      answerInput.focus();
    }
    return;
  }
  if (e.key !== 'Enter') return;
  if (e.target.value.trim() === '') return; // no-op on an empty box -- never advances or submits
  checkAnswer();
});
document.getElementById('answer2').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});
// Multiple-choice topics (letters/abc/nikud's #letterChoices and
// #letterSoundChoices, comparefractions' #compareChoices) get the same
// "move between answer widgets with arrow keys, no mouse required" treatment
// as the two-blank numeric boxes above. Attached once to each container
// (event delegation via keydown bubbling) rather than re-wired every render,
// since the container element itself persists across newExercise() calls --
// only its button children get recreated.
// Direction matters here in a way it didn't for the numeric boxes: this page
// is dir="rtl", and #letterChoices/#letterSoundChoices inherit that (first
// DOM button renders rightmost, confirmed by checking actual button
// positions) while #compareChoices forces direction:ltr (its '<'/'>' glyphs
// would otherwise render mirrored -- see the CSS). So ArrowRight/ArrowLeft
// have to map to opposite DOM-sibling directions depending on the
// container's own direction, or the arrows would visibly move the wrong way
// in one of the two cases.
function wireChoiceArrowNav(containerId) {
  const container = document.getElementById(containerId);
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const buttons = Array.from(container.querySelectorAll('button:not(:disabled)'));
    const currentIndex = buttons.indexOf(document.activeElement);
    if (currentIndex === -1) return; // focus isn't on one of this container's buttons
    e.preventDefault();
    const isRtl = getComputedStyle(container).direction === 'rtl';
    const movingToNextSibling = (e.key === 'ArrowRight') !== isRtl;
    const nextIndex = (currentIndex + (movingToNextSibling ? 1 : -1) + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  });
}
wireChoiceArrowNav('letterChoices');
wireChoiceArrowNav('letterSoundChoices');
wireChoiceArrowNav('compareChoices');
// Vertical bridges between a choice row and the single button next to it
// (the sound-play button above #letterChoices in listen mode, checkBtn below
// #letterSoundChoices in reverse mode). Both remember exactly which button
// in the row was focused when the player left it, and return there --
// deliberately *not* "return to whichever button is currently
// selected/correct," since those are different things: a player can arrow
// through several candidates to preview/reconsider them without
// re-confirming each one, and ArrowUp should undo the ArrowDown move, not
// silently teleport them back to an older selection. The remembered button
// is revalidated (still in the DOM, still enabled) before reuse, since a new
// exercise (fresh buttons) or an elimination (disabled) can invalidate it
// between visits -- falls back to the row's first available button then.
function focusRowRemembering(row, getLastFocused) {
  const last = getLastFocused();
  const target = (last && last.isConnected && !last.disabled) ? last : row.querySelector('button:not(:disabled)');
  if (target) target.focus();
}

// Listen mode (letters L1, abc L1-3, nikud): letterSoundBtn sits above
// #letterChoices, so ArrowDown from it enters the row and ArrowUp from the
// row leaves it -- opposite order from the reverse-mode bridge below, where
// checkBtn sits below its row instead.
let letterChoicesLastFocused = null;
document.getElementById('letterSoundBtn').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown') return;
  e.preventDefault();
  focusRowRemembering(document.getElementById('letterChoices'), () => letterChoicesLastFocused);
});
document.getElementById('letterChoices').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowUp') return;
  e.preventDefault();
  letterChoicesLastFocused = e.target;
  document.getElementById('letterSoundBtn').focus();
});

// Reverse mode (letters L2, abc L4): checkBtn is a genuinely separate
// "confirm" step only here -- letterChoices/compareChoices submit
// immediately on a button click and hide checkBtn entirely (see
// newExercise() in exercise-core.js), so this bridge doesn't apply to them.
// #letterSoundChoices sits above checkBtn, so ArrowDown leaves the row and
// ArrowUp enters it -- opposite order from the listen-mode bridge above.
// checkBtn is shared with the numeric exercises too (always visible there),
// so ArrowUp is scoped to reverse mode specifically, or pressing it during a
// numeric exercise would try to jump into a hidden row; checkBtn.disabled
// (true until a sound option is actually selected, see
// selectLetterReverseOption() in exercise-letters.js) is what stops
// ArrowDown from focusing an unconfirmable checkBtn before that.
let letterSoundChoicesLastFocused = null;
document.getElementById('letterSoundChoices').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown') return;
  const checkBtn = document.getElementById('checkBtn');
  if (checkBtn.disabled) return;
  e.preventDefault();
  letterSoundChoicesLastFocused = e.target;
  checkBtn.focus();
});
document.getElementById('checkBtn').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowUp' || !isLetterReverseMode()) return;
  e.preventDefault();
  focusRowRemembering(document.getElementById('letterSoundChoices'), () => letterSoundChoicesLastFocused);
});
document.getElementById('buyBtn').addEventListener('click', () => {
  buySoldier();
  document.getElementById('answer').focus();
});
// Global "buy soldier" hotkey (ח, first letter of חייל) -- the only
// document-level keydown listener in the app, since every other key binding
// so far is scoped to a specific focused element. Deliberately not scoped to
// any particular element (works no matter what currently has focus,
// including mid-typing in #answer/#answer2 -- ח isn't a digit so it's
// already silently stripped by their own input filter either way) since
// buying is a resource-spend action independent of whatever's currently
// being answered. Routes through the real button via .click() instead of
// calling buySoldier() directly so it automatically inherits every existing
// safeguard for free: the button's own disabled state (managed by
// updateCoinsDisplay()), buySoldier()'s own gameOver/insufficient-funds
// guard, and the click handler's refocus-to-#answer -- which itself already
// silently no-ops during letters/comparefractions exercises, since #answer
// sits inside the hidden #answerHome there, so this never yanks focus away
// from a letter-choice button mid-navigation.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ח') return;
  document.getElementById('buyBtn').click();
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
  modeMixedNumbersBtn: 'mixednumbers',
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
