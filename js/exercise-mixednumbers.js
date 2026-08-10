// ---------- Mixed-numbers exercise (p/b -> w  r/b, level 1 only) ----------
// Improper-looking fraction p/b, student fills in the whole part w and the
// remainder numerator r forming w  r/b (b is shown/fixed, never editable).
// See MIXED_NUM_* constants in config.js for the tunable ranges/chances.

function generateMixedNumberLevel1Exercise() {
  const forceZero = Math.random() < MIXED_NUM_L1_ZERO_CHANCE;
  let b, p, w, r;
  do {
    b = randInt(MIXED_NUM_DEN_MIN, MIXED_NUM_DEN_MAX);
    if (forceZero) {
      p = randInt(1, b - 1);
    } else {
      w = randInt(1, MIXED_NUM_WHOLE_MAX);
      r = randInt(0, b - 1);
      p = w * b + r;
    }
    w = Math.floor(p / b);
    r = p - w * b;
  } while (gcd(r, b) !== 1);

  return {
    improperNumerator: p, improperDenominator: b,
    targetWhole: w, targetRemainderNumerator: r, targetDenominator: b,
    answer: { whole: w, remainderNumerator: r },
  };
}

function generateMixedNumberExercise() {
  return generateMixedNumberLevel1Exercise(); // only level 1 exists so far
}

// Not reused from checkAnswer()'s generic isTwoBlank branch: that branch
// hardcodes .numerator/.denominator field names (currentAnswer here is
// {whole, remainderNumerator} instead), and more importantly its blank-input
// guard requires *every* box to be filled -- exactly the rule this exercise
// needs to break for the whole-number box only (blank there legitimately
// asserts 0, see [[project_mixed_numbers_plan]] in memory).
function checkMixedNumberAnswer() {
  if (gameOver) return;
  const answerInput = document.getElementById('answer');   // whole
  const answer2 = document.getElementById('answer2');       // remainder numerator
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (answer2.value.trim() === '') { // only the remainder box is ever required
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const wholeText = answerInput.value.trim();
  // A blank whole box asserts 0, exactly like typing "0" -- neither is
  // privileged, matching the requirement that the app bends to the math
  // (a real mixed number never writes out a zero whole part) rather than
  // forcing the student to type something that isn't real notation.
  const wholeGuess = wholeText === '' ? 0 : parseInt(wholeText, 10);
  const remainderGuess = parseInt(answer2.value, 10);
  const isCorrect = wholeGuess === currentAnswer.whole && remainderGuess === currentAnswer.remainderNumerator;

  if (isCorrect) {
    markCorrect(answerInput);
    checkBtn.disabled = true;
    answerInput.disabled = true;
    answer2.disabled = true;
    setTimeout(() => {
      checkBtn.disabled = false;
      answerInput.disabled = false;
      answer2.disabled = false;
      newExercise();
    }, 800);
  } else {
    markWrong(answerInput);
    answerInput.disabled = true;
    answer2.disabled = true;
    checkBtn.disabled = true;
    setTimeout(() => {
      answerInput.value = '';
      answer2.value = '';
      answerInput.disabled = false;
      answer2.disabled = false;
      checkBtn.disabled = false;
      answerInput.focus();
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}
