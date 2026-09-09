// ---------- Decimals exercise ----------
// Level 1 (the only level so far): a mixed number (whole + proper fraction,
// denominator always 10/100/1000) is shown, and the student types its
// decimal form freehand (e.g. "3.05") into #decimalTypedInput -- same
// typed-answer/checkBtn mechanic as grammar/vocabulary-level-4, just its own
// dedicated input since a decimal separator doesn't fit the digit-only
// filter every other numeric topic's #answer box uses. See the DECIMAL_*
// constants in config.js for the tunable ranges/chances.

// Correct answer (a decimal string, e.g. "3.05") for whatever exercise is
// currently on screen.
let currentDecimalAnswer = null;

// Picks how many digits the numerator gets, per DECIMAL_L1_* comment in
// config.js: denominator 10 has no real choice (a proper, non-multiple-of-10
// numerator under 10 is always a single digit); 100 splits 50/50 between one
// and two digits; 1000 splits 25/25/50 across one/two/three digits.
function pickDecimalNumeratorDigitCount(denominator) {
  if (denominator === 10) return 1;
  if (denominator === 100) return Math.random() < 0.5 ? 1 : 2;
  const r = Math.random();
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  return 3;
}

// Draws a numerator with exactly digitCount digits that's never a multiple
// of 10 -- guaranteed by construction (the last digit is always drawn from
// 1-9) rather than by drawing-then-rejecting, see [[feedback_no_reroll_mechanics]].
// Leading digit drawn from 1-9 too, so the digit count is exact (no leading
// zero shrinking a "two-digit" draw down to one digit).
function drawDecimalNumerator(digitCount) {
  if (digitCount === 1) return randInt(1, 9);
  if (digitCount === 2) return randInt(1, 9) * 10 + randInt(1, 9);
  return randInt(1, 9) * 100 + randInt(0, 9) * 10 + randInt(1, 9);
}

function generateDecimalLevel1Exercise() {
  const forceZero = Math.random() < DECIMAL_L1_ZERO_CHANCE;
  const whole = forceZero ? 0 : randInt(1, DECIMAL_WHOLE_MAX);
  const denominator = randChoice(DECIMAL_DENOMINATORS);
  const digitCount = pickDecimalNumeratorDigitCount(denominator);
  const numerator = drawDecimalNumerator(digitCount);
  // Decimal place count always matches the denominator's own zero count
  // (10->1, 100->2, 1000->3), regardless of the numerator's own digit count
  // -- padStart is exactly what supplies the "connecting zero(s)" this level
  // is built to drill (e.g. numerator=3, denominator=100 -> "03" -> 0.03).
  const places = String(denominator).length - 1;
  const decimalDigits = String(numerator).padStart(places, '0');

  return {
    whole, numerator, denominator,
    answer: `${whole}.${decimalDigits}`,
  };
}

// No level branching yet (only level 1 is implemented, see
// EXERCISE_TOPIC_LEVEL_COUNTS.decimals in config.js) -- kept as its own
// function anyway, matching every other topic's generate<Topic>Exercise()
// dispatcher shape, so a future level 2 slots in the same way mixed-numbers/
// addfractions etc. did.
function generateDecimalExercise() {
  return generateDecimalLevel1Exercise();
}

// Renders the shown side as a "mixed number = [blank]" equation inside the
// shared #questionText/.frac-eq (same visual language as every other
// fraction-family topic), reusing fractionBlockHTML()/mixedNumberDisplayHTML()
// from exercise-core.js. A whole part of 0 shows the fraction alone, no
// literal "0" -- same convention addfractionsadvanced's showsMixedAddends
// ternary uses for its own w=0 addends.
function renderDecimalExercise(ex) {
  const questionText = document.getElementById('questionText');
  const input = document.getElementById('decimalTypedInput');
  const shownHTML = ex.whole === 0
    ? fractionBlockHTML(ex.numerator, ex.denominator)
    : mixedNumberDisplayHTML(ex.whole, ex.numerator, ex.denominator);
  questionText.innerHTML =
    '<span class="frac-eq">' +
      shownHTML +
      '<span class="frac-op">=</span>' +
      '<span id="decimalAnswerSlot"></span>' +
    '</span>';
  document.getElementById('decimalAnswerSlot').appendChild(input);
  input.value = '';
  input.disabled = false;
  input.classList.remove('answer-revealed');
  input.focus();
}

// Accepts both '.' and ',' as the decimal separator (per user request) --
// normalized to '.' before comparing against currentDecimalAnswer, which is
// always built with '.'. Otherwise an exact match, same "no fuzzy/near-miss
// leniency" reasoning as normalizeGrammarTypedAnswer() (exercise-grammar.js)
// -- this level's whole point is the exact digit count/placement.
function normalizeDecimalTypedAnswer(s) {
  return s.trim().replace(/,/g, '.');
}

// Dispatched from checkAnswer() (exercise-core.js) via its
// gameMode === 'decimals' branch -- same shared checkBtn/Enter-to-submit flow
// every typed-answer topic uses.
function checkDecimalAnswer() {
  if (gameOver) return;

  const input = document.getElementById('decimalTypedInput');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (input.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const isCorrect = normalizeDecimalTypedAnswer(input.value) === currentDecimalAnswer;

  checkBtn.disabled = true;
  input.disabled = true;

  if (isCorrect) {
    markCorrect(input);
    setTimeout(() => {
      checkBtn.disabled = false;
      input.disabled = false;
      newExercise();
    }, 800);
  } else {
    markWrong(input);
    setTimeout(() => {
      input.value = '';
      input.disabled = false;
      checkBtn.disabled = false;
      input.focus();
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}

// Dispatched from changeQuestion() (exercise-core.js) the same way
// changeGrammarQuestion() is -- this topic's answer lives in
// #decimalTypedInput rather than the generic #answer/#answer2/#answer3
// changeQuestion() otherwise operates on.
function changeDecimalQuestion() {
  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const input = document.getElementById('decimalTypedInput');
  if (swapBtn.disabled) return; // already mid-reveal

  playerMoney -= SWAP_QUESTION_COST;
  swapCount++;
  recordWeakPoolSwap();
  updateCoinsDisplay();
  updateStatsCountersDisplay();
  showFloatingText(`-${SWAP_QUESTION_COST}`, 'negative', swapBtn);

  swapBtn.disabled = true;
  checkBtn.disabled = true;
  input.disabled = true;
  input.value = currentDecimalAnswer;
  input.classList.add('answer-revealed');

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  swapTimeoutId = setTimeout(() => {
    checkBtn.disabled = false;
    input.disabled = false;
    swapBtn.disabled = false;
    newExercise(); // renderDecimalExercise() clears .answer-revealed for the new round
  }, SWAP_REVEAL_MS);
}
