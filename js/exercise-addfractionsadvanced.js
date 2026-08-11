// ---------- Fraction-addition-advanced exercise ("חיבור שברים מתקדם") ----------
// Level 1: p/n + q/n, same same-denominator mechanic as addfractions level 1,
// but the sum may exceed n -- the answer is a mixed number (whole 0 or 1 +
// remainder over the fixed denominator n) instead of a single blank
// numerator. Same {whole, remainderNumerator} answer shape as mixed-numbers
// level 1 (see exercise-mixednumbers.js), which is why isWholeBoxAnswerLevel()
// in exercise-core.js and the shared #answer/#answer2 keyboard handlers in
// main.js already know how to treat this level's whole box (side-by-side
// with the fraction, blank legitimately asserts 0) without any topic-specific
// wiring there.
// Level 2: same mechanic, but the remainder fraction may need reducing too --
// {whole, numerator, denominator} across *three* boxes, the exact same shape
// mixed-numbers level 3 already established. isThreeBoxAnswerLevel() in
// exercise-core.js and #answer3's own keydown listener
// (wireMixedNumberLevel3Answer3Nav() in exercise-mixednumbers.js, fully
// generic -- it doesn't check gameMode at all) already handle this shape too,
// so only the generator/checker below and the render branch in
// exercise-core.js's newExercise() are new for level 2.

function isAddFractionsAdvancedLevel1() {
  return gameMode === 'addfractionsadvanced' && exerciseDifficultyIndex === 0;
}

function isAddFractionsAdvancedLevel2() {
  return gameMode === 'addfractionsadvanced' && exerciseDifficultyIndex === 1;
}

function isAddFractionsAdvancedLevel3() {
  return gameMode === 'addfractionsadvanced' && exerciseDifficultyIndex === 2;
}

function isAddFractionsAdvancedLevel4() {
  return gameMode === 'addfractionsadvanced' && exerciseDifficultyIndex === 3;
}

// sum = p+q is always < 2n (p,q both < n), so w is only ever 0 or 1.
// Rejecting gcd(r,n) !== 1 keeps the remainder always already reduced, and
// also excludes r=0 for free (gcd(0,n)=n, never 1 for n>1) -- same trick
// generateMixedNumberLevel1Exercise() uses in exercise-mixednumbers.js.
function generateFractionAdditionAdvancedLevel1Exercise() {
  const forceOverflow = Math.random() < ADD_FRAC_ADV_L1_OVERFLOW_CHANCE;
  let n, p, q, sum, w, r;
  do {
    n = randInt(ADD_FRAC_ADV_L1_DEN_MIN, ADD_FRAC_ADV_L1_DEN_MAX);
    p = randInt(1, n - 1);
    q = randInt(1, n - 1);
    sum = p + q;
    w = sum >= n ? 1 : 0;
    r = sum - w * n;
  } while ((forceOverflow ? w === 0 : w === 1) || gcd(r, n) !== 1);

  return {
    pNum: p, pDen: n, qNum: q, qDen: n,
    targetWhole: w, targetRemainderNumerator: r, targetDenominator: n,
    answer: { whole: w, remainderNumerator: r },
  };
}

// Same p/n + q/n mechanic and the same ADD_FRAC_ADV_L1_DEN_MIN/MAX and
// ADD_FRAC_ADV_L1_OVERFLOW_CHANCE as level 1 (reused, not separate L2
// constants -- see config.js), but ADD_FRAC_ADV_L2_REDUCTION_CHANCE (70%) of
// draws force gcd(r,n)>1 so the remainder needs reducing; the rest leave it
// already reduced (matching level 1's own constraint). r===0 is rejected
// explicitly (not just via gcd(r,n)!==1) because gcd(0,n)=n trivially
// satisfies ">1" for any n>1 -- same trap generateMixedNumberLevel3Exercise()
// guards against in exercise-mixednumbers.js.
function generateFractionAdditionAdvancedLevel2Exercise() {
  const forceOverflow = Math.random() < ADD_FRAC_ADV_L1_OVERFLOW_CHANCE;
  const requireReduction = Math.random() < ADD_FRAC_ADV_L2_REDUCTION_CHANCE;
  let n, p, q, sum, w, r, g;
  do {
    n = randInt(ADD_FRAC_ADV_L1_DEN_MIN, ADD_FRAC_ADV_L1_DEN_MAX);
    p = randInt(1, n - 1);
    q = randInt(1, n - 1);
    sum = p + q;
    w = sum >= n ? 1 : 0;
    r = sum - w * n;
    g = gcd(r, n);
  } while ((forceOverflow ? w === 0 : w === 1) || r === 0 || (requireReduction ? g <= 1 : g !== 1));

  return {
    pNum: p, pDen: n, qNum: q, qDen: n,
    targetWhole: w, targetNumerator: r / g, targetDenominator: n / g,
    answer: { whole: w, numerator: r / g, denominator: n / g },
  };
}

// Both addends are themselves mixed numbers (W1 p/n, W2 q/n) instead of
// plain fractions -- W1/W2 each drawn uniformly from 0-9 (10% chance each of
// landing on exactly 0, which newExercise() in exercise-core.js renders as a
// plain fraction with no whole part shown, same "never write a literal zero
// whole part" convention mixed-numbers already established -- a fold-in to a
// simpler visual case, not a special code path). Fraction parts are always
// already reduced (gcd(p,n)=1, gcd(q,n)=1, which also excludes p=0/q=0 for
// free, same trick used throughout this file). No reduction on the result
// either -- gcd(r,n)=1 always (excludes r=0 for free too). At most a single
// carry into the whole part, since p,q<n each means p+q<2n.
function generateFractionAdditionAdvancedLevel3Exercise() {
  let n, p, q, sum, carry, r;
  do {
    n = randInt(ADD_FRAC_ADV_L1_DEN_MIN, ADD_FRAC_ADV_L1_DEN_MAX);
    p = randInt(1, n - 1);
    q = randInt(1, n - 1);
    sum = p + q;
    carry = sum >= n ? 1 : 0;
    r = sum - carry * n;
  } while (gcd(p, n) !== 1 || gcd(q, n) !== 1 || gcd(r, n) !== 1);
  const w1 = randInt(0, 9);
  const w2 = randInt(0, 9);
  const w = w1 + w2 + carry;

  return {
    pWhole: w1, pNum: p, pDen: n,
    qWhole: w2, qNum: q, qDen: n,
    targetWhole: w, targetRemainderNumerator: r, targetDenominator: n,
    answer: { whole: w, remainderNumerator: r },
  };
}

// Same both-addends-are-mixed-numbers mechanic as level 3 (same W1/W2
// ranges/zero-rate), but ADD_FRAC_ADV_L2_REDUCTION_CHANCE (70%, reused from
// level 2 -- not a separate L4 constant) of draws force gcd(r,n)>1 so the
// remainder needs reducing; the rest leave it already reduced (matching
// level 3's own constraint). Same relationship level 2 has to level 1.
function generateFractionAdditionAdvancedLevel4Exercise() {
  const requireReduction = Math.random() < ADD_FRAC_ADV_L2_REDUCTION_CHANCE;
  let n, p, q, sum, carry, r, g;
  do {
    n = randInt(ADD_FRAC_ADV_L1_DEN_MIN, ADD_FRAC_ADV_L1_DEN_MAX);
    p = randInt(1, n - 1);
    q = randInt(1, n - 1);
    sum = p + q;
    carry = sum >= n ? 1 : 0;
    r = sum - carry * n;
    g = gcd(r, n);
  } while (gcd(p, n) !== 1 || gcd(q, n) !== 1 || r === 0 || (requireReduction ? g <= 1 : g !== 1));
  const w1 = randInt(0, 9);
  const w2 = randInt(0, 9);
  const w = w1 + w2 + carry;

  return {
    pWhole: w1, pNum: p, pDen: n,
    qWhole: w2, qNum: q, qDen: n,
    targetWhole: w, targetNumerator: r / g, targetDenominator: n / g,
    answer: { whole: w, numerator: r / g, denominator: n / g },
  };
}

function generateFractionAdditionAdvancedExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 2) return generateFractionAdditionAdvancedLevel2Exercise();
  if (level === 3) return generateFractionAdditionAdvancedLevel3Exercise();
  if (level === 4) return generateFractionAdditionAdvancedLevel4Exercise();
  return generateFractionAdditionAdvancedLevel1Exercise();
}

// Dispatches by level, same convention checkMixedNumberAnswer() uses in
// exercise-mixednumbers.js -- called from exercise-core.js's checkAnswer().
// Levels 3/4 fall into the same branches as levels 1/2 respectively -- their
// answers are the exact same shapes (only the *shown* addends differ), so
// neither needs a dedicated checker of its own.
function checkFractionAdditionAdvancedAnswer() {
  if (isAddFractionsAdvancedLevel2() || isAddFractionsAdvancedLevel4()) {
    checkFractionAdditionAdvancedLevel2Answer();
  } else {
    checkFractionAdditionAdvancedLevel1Answer();
  }
}

// Mirrors checkMixedNumberToMixedAnswer() in exercise-mixednumbers.js exactly
// (same answer shape, same blank-whole-box-asserts-0 rule) -- kept as its own
// function per this codebase's per-topic-checker convention rather than
// calling across into the mixednumbers file.
function checkFractionAdditionAdvancedLevel1Answer() {
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

// Mirrors checkMixedNumberReducedAnswer() in exercise-mixednumbers.js exactly
// (same three-box shape, same blank-whole-box-asserts-0 rule, answer2/
// answer3 always required).
function checkFractionAdditionAdvancedLevel2Answer() {
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
