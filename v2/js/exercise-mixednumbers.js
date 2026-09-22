// ---------- Mixed-numbers exercise (levels 1-4) ----------
// Level 1: p/b -> w  r/b (improper fraction to mixed number, two blanks,
// r/b always already reduced -- no reduction step at this level).
// Level 2: w  r/b -> [?]/b (mixed number to improper fraction, one blank).
// Level 3: p/b -> w  [?]/[?] (like level 1, but the remainder fraction may
// need reducing, so it's asked as its own two blanks -- #answer is the
// *same* whole-number box as level 1, same behavior and all, #answer2/
// #answer3 are the reduced numerator/denominator. The app's first
// three-blank exercise.)
// Level 4: w  r/a -> [?]/[?] (like level 2, but the resulting improper
// fraction may need reducing -- both boxes blank, #answer/#answer2 only,
// same generic "stacked two-blank" shape every other topic's own reduction
// level already uses, since w is never a blank here -- see
// isMixedNumberWholeBoxLevel() below for why this needs no special-casing
// at all outside this file).
// All four return {direction, answer, ...} -- newExercise() in
// exercise-core.js branches on `direction` to pick which template/DOM slots
// to render into. See MIXED_NUM_* constants in config.js for the tunable
// ranges/chances, and the isMixedNumberLevel*() helpers below, which
// several cross-cutting concerns (arrow-key direction, blur-styling, the
// swap-question reveal) need to tell the levels' shapes apart -- level 1
// and level 3 are *both* `typeof currentAnswer === 'object'`, but level 3
// has an extra box and an extra field, and needs its own dedicated keyboard
// wiring in main.js (kept self-contained there, not woven into the
// #answer/#answer2 handlers every other topic shares) rather than trying to
// generalize the shared two-box machinery to a variable number of boxes.
// Level 4 needs none of that special-casing -- its two-blank shape is
// identical to e.g. addfractions' own reduction levels, so it rides the
// existing shared machinery for free.

function isMixedNumberLevel1() {
  return gameMode === 'mixednumbers' && exerciseDifficultyIndex === 0;
}

function isMixedNumberLevel3() {
  return gameMode === 'mixednumbers' && exerciseDifficultyIndex === 2;
}

// True for level 1 or level 3 -- both give the whole-number box (#answer)
// the *exact* same behavior: it sits side by side with (not stacked on) the
// fraction part, and a blank box there is a legitimate answer (asserts 0),
// never an omission. Level 3 additionally has #answer2/#answer3 for the
// reduced fraction, which level 1 doesn't -- see isMixedNumberLevel3().
// Shared by main.js's arrow-key/blur-styling gates (mirrors
// isLetterReverseMode() in exercise-letters.js, called cross-file the same
// way); changeQuestion() in exercise-core.js still needs isMixedNumberLevel1()/
// isMixedNumberLevel3() separately since their reveal shapes differ.
function isMixedNumberWholeBoxLevel() {
  return isMixedNumberLevel1() || isMixedNumberLevel3();
}

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
    direction: 'toMixed',
    improperNumerator: p, improperDenominator: b,
    targetWhole: w, targetRemainderNumerator: r, targetDenominator: b,
    answer: { whole: w, remainderNumerator: r },
  };
}

// Reverse direction: a *given* mixed number w  r/b (w>=1 always -- unlike
// level 1, there's no zero-whole sub-case here, since w is a given, not
// something the student has to notice/produce) with its fractional part
// already in lowest terms (gcd(r,b)=1, same "givens are always pre-reduced"
// convention used elsewhere in this app -- see [[feedback_exercise_no_giveaway_design]]).
// One blank: the resulting improper fraction's numerator, over the same
// fixed denominator b.
function generateMixedNumberLevel2Exercise() {
  let b, r;
  do {
    b = randInt(MIXED_NUM_DEN_MIN, MIXED_NUM_DEN_MAX);
    r = randInt(1, b - 1);
  } while (gcd(r, b) !== 1);
  const w = randInt(1, MIXED_NUM_WHOLE_MAX);
  const numerator = w * b + r;

  return {
    direction: 'toImproper',
    shownWhole: w, shownRemainderNumerator: r, shownDenominator: b,
    targetNumerator: numerator, targetDenominator: b,
    answer: numerator,
  };
}

// Same decomposition as level 1 (p/b -> w + r/b, same
// MIXED_NUM_L1_ZERO_CHANCE zero-whole sub-case -- w is blank-allowed here
// too, exactly like level 1), but MIXED_NUM_L3_REDUCTION_CHANCE (70%) of
// draws force gcd(r,b)>1 so the remainder fraction needs reducing; the rest
// leave it already reduced (matching level 1's own constraint). Every
// level-3 exercise -- both the reducible 70% and the already-reduced 30% --
// renders with both fraction boxes blank and the "צמצם ככל הניתן" label
// shown (see newExercise() in exercise-core.js), so the student can't tell
// which sub-case they're in from the UI shape -- see
// [[feedback_exercise_no_giveaway_design]].
function generateMixedNumberLevel3Exercise() {
  const forceZero = Math.random() < MIXED_NUM_L1_ZERO_CHANCE;
  const requireReduction = Math.random() < MIXED_NUM_L3_REDUCTION_CHANCE;
  let b, p, w, r, g;
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
    g = gcd(r, b);
    // r=0 must be rejected explicitly here (unlike level 1, where requiring
    // gcd(r,b)=1 excludes it for free -- gcd(0,b)=b, never 1). Level 3 also
    // accepts gcd(r,b)>1 draws, and gcd(0,b)=b satisfies ">1" vacuously for
    // any b>1 -- without this check r=0 (p an exact multiple of b, i.e. no
    // real fractional remainder at all) would slip in as a fake "reducible"
    // exercise.
  } while (r === 0 || (requireReduction ? g <= 1 : g !== 1));

  return {
    direction: 'toMixedReduced',
    improperNumerator: p, improperDenominator: b,
    targetWhole: w, targetNumerator: r / g, targetDenominator: b / g,
    answer: { whole: w, numerator: r / g, denominator: b / g },
  };
}

// Reverse direction, same relationship level 2 has to level 4 that level 1
// has to level 3: a *given* mixed number w  r/a (w>=1 always, same as level
// 2 -- w is never blank here, so there's no zero-whole sub-case to worry
// about), but the fractional part isn't guaranteed already reduced --
// MIXED_NUM_L4_REDUCTION_CHANCE (70%) of draws force gcd(r,a)>1, so the
// resulting improper fraction needs reducing too (gcd(w*a+r,a)=gcd(r,a),
// same identity level 3 relies on); the rest leave it already reduced
// (matching level 2's own constraint). Both boxes blank either way -- w is
// shown as given text, never asked, so the answer shape never leaks which
// sub-case was drawn (same uniform-UI reasoning as level 3's fraction
// part) -- rendered with the "צמצם ככל הניתן" label like every other
// reduction level in this app.
function generateMixedNumberLevel4Exercise() {
  const requireReduction = Math.random() < MIXED_NUM_L4_REDUCTION_CHANCE;
  let a, r, g;
  do {
    a = randInt(MIXED_NUM_DEN_MIN, MIXED_NUM_DEN_MAX);
    r = randInt(1, a - 1);
    g = gcd(r, a);
  } while (requireReduction ? g <= 1 : g !== 1);
  const w = randInt(1, MIXED_NUM_WHOLE_MAX);
  const numerator = w * a + r;

  return {
    direction: 'toImproperReduced',
    shownWhole: w, shownRemainderNumerator: r, shownDenominator: a,
    targetNumerator: numerator / g, targetDenominator: a / g,
    answer: { numerator: numerator / g, denominator: a / g },
  };
}

function generateMixedNumberExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 4) return generateMixedNumberLevel4Exercise();
  if (level === 3) return generateMixedNumberLevel3Exercise();
  if (level === 2) return generateMixedNumberLevel2Exercise();
  return generateMixedNumberLevel1Exercise();
}

// Dispatches by level (not by currentAnswer's shape -- level 1 and level 3
// are *both* {whole/numerator, ...}-style objects, so a shape-only check
// like checkAnswer()'s generic isTwoBlank can't tell them apart). Matches
// how generateMixedNumberExercise() above already derives the level from
// exerciseDifficultyIndex, which can't change mid-exercise during a live
// game (only the pre-game difficulty picker touches it).
function checkMixedNumberAnswer() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 4) {
    checkMixedNumberImproperReducedAnswer();
  } else if (level === 3) {
    checkMixedNumberReducedAnswer();
  } else if (level === 2) {
    checkMixedNumberToImproperAnswer();
  } else {
    checkMixedNumberToMixedAnswer();
  }
}

// Level 1: not reused from checkAnswer()'s generic isTwoBlank branch -- that
// branch hardcodes .numerator/.denominator field names (currentAnswer here
// is {whole, remainderNumerator} instead), and more importantly its
// blank-input guard requires *every* box to be filled -- exactly the rule
// this exercise needs to break for the whole-number box only (blank there
// legitimately asserts 0, see [[project_mixed_numbers_plan]] in memory).
function checkMixedNumberToMixedAnswer() {
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

// Level 2: a single, always-required blank (unlike level 1, w is a given
// here, never something the student may legitimately omit) -- so this
// mirrors the generic single-blank path in checkAnswer() almost exactly,
// just kept local since currentAnswer's shape (a plain number, not
// {numerator, denominator}) doesn't match what that generic path expects
// for a fraction-style answer either.
function checkMixedNumberToImproperAnswer() {
  if (gameOver) return;
  const answerInput = document.getElementById('answer');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (answerInput.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const isCorrect = parseInt(answerInput.value, 10) === currentAnswer;

  if (isCorrect) {
    markCorrect(answerInput);
    checkBtn.disabled = true;
    answerInput.disabled = true;
    setTimeout(() => {
      checkBtn.disabled = false;
      answerInput.disabled = false;
      newExercise();
    }, 800);
  } else {
    markWrong(answerInput);
    answerInput.disabled = true;
    checkBtn.disabled = true;
    setTimeout(() => {
      answerInput.value = '';
      answerInput.disabled = false;
      checkBtn.disabled = false;
      answerInput.focus();
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}

// Level 4: both boxes always required (w is given here, exactly like level
// 2 -- never blank, never asked). currentAnswer's shape ({numerator,
// denominator}) matches the generic two-blank pattern other topics' own
// reduction levels use, and #answer/#answer2 already get the right generic
// keyboard treatment for free (isMixedNumberWholeBoxLevel() only covers
// levels 1/3, so level 4 falls straight into the ordinary stacked-two-blank
// Up/Down handling in main.js, and changeQuestion()'s generic reveal branch
// in exercise-core.js already handles {numerator, denominator} too) -- this
// stays a dedicated function only because checkMixedNumberAnswer() routes
// every mixednumbers level through this file regardless (see
// exercise-core.js's checkAnswer()).
function checkMixedNumberImproperReducedAnswer() {
  if (gameOver) return;
  const answerInput = document.getElementById('answer');   // numerator
  const answer2 = document.getElementById('answer2');       // denominator
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (answerInput.value.trim() === '' || answer2.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const isCorrect = parseInt(answerInput.value, 10) === currentAnswer.numerator &&
    parseInt(answer2.value, 10) === currentAnswer.denominator;

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

// Level 3: three boxes. #answer (whole) has the *exact same* blank-allowed
// semantics as checkMixedNumberToMixedAnswer() above (blank asserts 0, "0"
// typed is equally accepted, neither privileged) -- #answer2/#answer3
// (reduced numerator/denominator) are always required, same "both blank"
// convention as every other reduction level in this app. currentAnswer's
// field names don't match any generic branch elsewhere (three fields, one
// of them named `whole`), so this stays fully self-contained here rather
// than trying to reuse checkAnswer()'s generic branch -- checkAnswer()
// dispatches *every* mixednumbers exercise through checkMixedNumberAnswer()
// up front regardless (see exercise-core.js).
function checkMixedNumberReducedAnswer() {
  if (gameOver) return;
  const answerInput = document.getElementById('answer');   // whole
  const answer2 = document.getElementById('answer2');       // reduced numerator
  const answer3 = document.getElementById('answer3');       // reduced denominator
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (answer2.value.trim() === '' || answer3.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const wholeText = answerInput.value.trim();
  const wholeGuess = wholeText === '' ? 0 : parseInt(wholeText, 10);
  const isCorrect = wholeGuess === currentAnswer.whole &&
    parseInt(answer2.value, 10) === currentAnswer.numerator &&
    parseInt(answer3.value, 10) === currentAnswer.denominator;

  if (isCorrect) {
    markCorrect(answerInput);
    checkBtn.disabled = true;
    answerInput.disabled = true;
    answer2.disabled = true;
    answer3.disabled = true;
    setTimeout(() => {
      checkBtn.disabled = false;
      answerInput.disabled = false;
      answer2.disabled = false;
      answer3.disabled = false;
      newExercise();
    }, 800);
  } else {
    markWrong(answerInput);
    answerInput.disabled = true;
    answer2.disabled = true;
    answer3.disabled = true;
    checkBtn.disabled = true;
    setTimeout(() => {
      answerInput.value = '';
      answer2.value = '';
      answer3.value = '';
      answerInput.disabled = false;
      answer2.disabled = false;
      answer3.disabled = false;
      checkBtn.disabled = false;
      answerInput.focus();
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}

// #answer3's keyboard wiring: entirely new, since no other topic ever
// touches this box -- ArrowUp goes back to #answer2 (numerator, stacked
// directly above it within the fraction block); Enter submits (last box in
// the chain). #answer (whole) <-> #answer2 (numerator) reuses the *existing*
// isMixedNumberWholeBoxLevel()-gated Left/Right branches in main.js's
// #answer/#answer2 handlers (same side-by-side spatial relationship level 1
// already has) -- and #answer2's Enter/ArrowDown-toward-#answer3 redirect
// lives right there in main.js too (one guarded branch, not a second
// competing listener on the same element -- see the comment there).
// ArrowLeft also jumps #answer3 straight to the whole box, not just up to
// #answer2 first -- the whole box floats vertically centered against the
// *entire* fraction stack (see .frac-eq's align-items:center), roughly
// level with the gap between numerator and denominator, so "left" reads as
// the right direction from either box in the stack, not only the top one.
function wireMixedNumberLevel3Answer3Nav() {
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const answer3 = document.getElementById('answer3');
  answer3.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      answer2.focus();
      return;
    }
    if (e.key === 'ArrowLeft') {
      const atStart = e.target.value === '' ||
        (e.target.selectionStart === 0 && e.target.selectionEnd === 0);
      if (atStart) {
        e.preventDefault();
        answerInput.focus();
      }
      return;
    }
    if (e.key !== 'Enter') return;
    if (e.target.value.trim() === '') return; // no-op on an empty box
    checkAnswer();
  });
  answer3.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
}
wireMixedNumberLevel3Answer3Nav();
