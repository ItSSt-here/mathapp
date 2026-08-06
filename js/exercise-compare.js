// ---------- Compare-fractions exercise (which fraction is bigger?) ----------
// Level 1: randomly picks one of two sub-cases so the student can't coast on
// one memorized rule --
//   same denominator: p/n vs q/n (p != q) -- bigger numerator wins.
//   same numerator:   n/p vs n/q (p != q) -- SMALLER denominator wins (fewer,
//     bigger slices), the easy one to get backwards if you don't reason it out.
// Both fractions are always proper (numerator < denominator). Answer is
// always '<' or '>' -- COMPARE_OPTIONS in config.js already leaves room to
// add '=' later via a same-value sub-case.
function generateCompareFractionsLevel1Exercise() {
  const sameDenominator = Math.random() < 0.5;
  let leftNum, leftDen, rightNum, rightDen, correct;

  if (sameDenominator) {
    const den = randInt(COMPARE_FRAC_SAME_DEN_MIN, COMPARE_FRAC_SAME_DEN_MAX);
    [leftNum, rightNum] = pickDistinctRandom(rangeArray(1, den - 1), 2);
    leftDen = rightDen = den;
    correct = leftNum > rightNum ? '>' : '<';
  } else {
    const num = randInt(COMPARE_FRAC_SAME_NUM_MIN, COMPARE_FRAC_SAME_NUM_MAX);
    [leftDen, rightDen] = pickDistinctRandom(rangeArray(num + 1, num + COMPARE_FRAC_DEN_SPREAD), 2);
    leftNum = rightNum = num;
    correct = leftDen < rightDen ? '>' : '<';
  }

  return { leftNum, leftDen, rightNum, rightDen, correct };
}

// Level 2 (currently every level 2-5, see EXERCISE_LEVEL_DESCRIPTIONS.comparefractions
// in config.js): "complement to whole" sub-case -- p/a vs q/b where both
// fractions are the same distance `d` from 1 (a-p = b-q = d), with a != b.
// d is fixed at COMPARE_FRAC_COMPLEMENT_D (1) for now -- randomizing it made
// the trick too hard to spot. Since p/a = 1 - d/a: comparing p/a vs q/b is
// the same as comparing d/a vs d/b (level 1's same-numerator rule --
// smaller denominator wins) and then FLIPPING the conclusion, because a
// bigger complement means a smaller original fraction. Net effect collapses
// to a direct denominator comparison: the larger denominator (smaller gap
// to 1) is the bigger fraction.
function generateCompareFractionsComplementExercise() {
  const d = COMPARE_FRAC_COMPLEMENT_D;
  const [a, b] = pickDistinctRandom(rangeArray(d + 1, d + COMPARE_FRAC_DEN_SPREAD), 2);
  const leftNum = a - d, leftDen = a;
  const rightNum = b - d, rightDen = b;
  const correct = a < b ? '<' : '>';
  return { leftNum, leftDen, rightNum, rightDen, correct };
}

// Level 3 (currently every level 3-5): "one denominator is a multiple of the
// other" case -- q/a vs (b*q +/- n)/(b*a). The second denominator is always
// a multiple of the first, so the trick is expanding q/a to the common
// denominator ((b*q)/(b*a)) and then just comparing numerators: b*q vs
// b*q+n. 10% of exercises use n=0, making the two fractions exactly equal --
// the first case where '=' is a real answer (see COMPARE_OPTIONS_WITH_EQUAL
// in config.js). Rejection loop only guards against a negative/zero
// right-hand numerator; everything else about the random draw is already
// safe (q < a keeps the left fraction proper, and b*q+n stays reasonably
// close to b*a given the small ranges in config.js).
function generateCompareFractionsLevel3Exercise() {
  const isEqual = Math.random() < COMPARE_FRAC_L3_EQUAL_CHANCE;
  let a, b, q, n, rightNum;

  do {
    a = randInt(COMPARE_FRAC_L3_A_MIN, COMPARE_FRAC_L3_A_MAX);
    b = randInt(COMPARE_FRAC_L3_B_MIN, COMPARE_FRAC_L3_B_MAX);
    q = randInt(1, a - 1);
    n = isEqual ? 0 : randInt(1, COMPARE_FRAC_L3_N_MAX) * randChoice([1, -1]);
    rightNum = b * q + n;
  } while (rightNum < 1);

  const correct = n === 0 ? '=' : (n > 0 ? '<' : '>');
  return { leftNum: q, leftDen: a, rightNum, rightDen: b * a, correct };
}

// Level 4 (currently every level 4-5): identical comparison to level 3 --
// only the *display* of the left fraction changes, inflated by a random
// factor m (same b/b2 mechanism the "fractions" topic's reduction exercises
// use) so the student has to recognize/reduce it (or spot m as a common
// factor) before applying level 3's technique. m*q/m*a is the same value as
// q/a, so `correct` is untouched -- only leftNum/leftDen get inflated.
function generateCompareFractionsLevel4Exercise() {
  const base = generateCompareFractionsLevel3Exercise();
  const m = randInt(COMPARE_FRAC_L4_M_MIN, COMPARE_FRAC_L4_M_MAX);
  return { leftNum: m * base.leftNum, leftDen: m * base.leftDen, rightNum: base.rightNum, rightDen: base.rightDen, correct: base.correct };
}

function generateCompareFractionsExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level >= 4) {
    return generateCompareFractionsLevel4Exercise();
  }
  if (level >= 3) {
    return generateCompareFractionsLevel3Exercise();
  }
  if (level >= 2 && Math.random() < 0.5) {
    return generateCompareFractionsComplementExercise();
  }
  return generateCompareFractionsLevel1Exercise();
}

// Renders the pick buttons into #compareChoices, in its own row below the
// question (#compareAnswerHome in index.html) rather than inline with the
// fractions -- reuses .letter-choice-btn so the correct/wrong/disabled
// states match every other multiple-choice topic without duplicating that
// CSS. `options` is COMPARE_OPTIONS (just '<'/'>') below level 3, or
// COMPARE_OPTIONS_WITH_EQUAL (adds '=') from level 3 onward -- see
// newExercise() in exercise-core.js.
function renderCompareChoices(options) {
  const container = document.getElementById('compareChoices');
  container.innerHTML = '';
  container.classList.remove('compare-choices-locked');
  options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'letter-choice-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => checkCompareAnswer(option, btn));
    container.appendChild(btn);
  });
  if (container.firstElementChild) container.firstElementChild.focus();
}

// Only two options exist, so unlike checkLetterAnswer()'s eliminate-and-retry
// pattern, a wrong pick here can't just disable that one button -- the other
// would then be a free correct answer. Instead a wrong pick reveals the
// correct answer in #compareBlank (red, same convention as
// input.answer-revealed:disabled for the swap-question button) and moves on
// to a new question after SWAP_REVEAL_MS, same pause changeQuestion() uses.
function checkCompareAnswer(selected, btnEl) {
  if (gameOver) return;

  const container = document.getElementById('compareChoices');
  if (container.classList.contains('compare-choices-locked')) return;

  const blank = document.getElementById('compareBlank');
  const isCorrect = selected === currentCompareAnswer;

  container.classList.add('compare-choices-locked');
  Array.from(container.children).forEach(b => b.disabled = true);

  if (isCorrect) {
    blank.textContent = selected;
    blank.classList.add('answer-correct');
    btnEl.classList.add('letter-correct');
    markCorrect(btnEl);
    setTimeout(newExercise, 800);
  } else {
    btnEl.classList.add('letter-wrong');
    blank.textContent = currentCompareAnswer;
    blank.classList.add('revealed');
    markWrong(btnEl, 'לא נכון');
    setTimeout(newExercise, SWAP_REVEAL_MS);
  }
}
