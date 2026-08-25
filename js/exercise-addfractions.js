// ---------- Fraction-addition exercise (p/n + q/n = [?]/n, and variants) ----------
// Every level's generator returns {pNum, pDen, qNum, qDen, missing,
// targetNumerator, targetDenominator, answer} -- newExercise() in
// exercise-core.js renders pNum/pDen and qNum/qDen as the two shown addends
// regardless of whether they share a denominator (levels 1-2, 3) or not
// (levels 4-5), and fills the blank(s) from missing/targetNumerator/targetDenominator.
// The actual generation lives in exercise-fraction-arithmetic.js, shared with
// exercise-subtractfractions.js -- see that file's header comment for why.
// Level 3 (the scaffold, see below) is the one exception: it renders through
// its own dedicated branch in newExercise() instead of renderFractionAnswerEquation(),
// since its answer shape (two blanks in two different fraction slots, not one
// fraction's numerator+denominator) doesn't fit that shared template.

// Level 1: same-denominator addition, always a proper and already-reduced
// result -- n is drawn wide (3-20, see FRAC_ADD_DEN_MIN/MAX in config.js)
// since this topic comes after "שברים", where the student has already met
// many denominators.
function generateFractionAdditionLevel1Exercise() {
  return generateSameDenomLevel1Exercise(FRAC_ADD_DEN_MIN, FRAC_ADD_DEN_MAX, 'add');
}

// Level 2: same mechanic, but FRAC_ADD_L2_REDUCTION_CHANCE (70%) of the time
// the draw is forced so the sum/n result needs reducing. Every level-2
// exercise (both the reducible 70% and the already-reduced 30%) is rendered
// with missing: 'both' -- numerator AND denominator blanked, same convention
// as the "fractions" topic's full-reduction exercises, including the
// "צמצם ככל הניתן" label -- see newExercise(). Deliberately uniform: if only
// the reducible 70% got two blanks and the other 30% got level 1's single
// blank, the number of blanks alone (and therefore the label's presence)
// would give away whether reduction is needed before the student even does
// the math. In the 30% case targetNumerator/targetDenominator just come out
// equal to sum/n unchanged (g === 1), so the student's "reduced" answer is
// the sum itself -- there's nothing to actually simplify, but the blank
// shape looks identical either way.
function generateFractionAdditionLevel2Exercise() {
  return generateSameDenomLevel2Exercise(FRAC_ADD_DEN_MIN, FRAC_ADD_DEN_MAX, 'add', FRAC_ADD_L2_REDUCTION_CHANCE);
}

// Level 3 (scaffold, added 2026-08-25): the exact same p/a + q/(b*a) draw as
// level 4 below (same a/b ranges, same generateMultipleDenomLevel3Exercise()
// call), but b1Chance is forced to 0 instead of reading FRAC_ADD_L3_B1_CHANCE
// -- level 4's b=1 fold-in collapses into same-denominator addition with
// nothing to expand, which would defeat this level's entire point. Rather
// than asking directly for the sum's numerator (level 4's single blank),
// this level isolates the "expand to a common denominator" step: the given
// problem is shown with no result at all, then shown again underneath with
// whichever fraction had the smaller denominator (a) already rewritten over
// the shared denominator (b*a) -- its own numerator (m*b) is the first
// blank, and the sum's numerator (same as level 4's answer) is the second.
// `pIsExpandSide` records which shown side (pNum/pDen or qNum/qDen) is the
// one needing expansion, purely for newExercise()'s render branch -- it's
// always derivable after the fact from pDen/qDen (exactly one of them
// already equals targetDenominator, since b>=2 is guaranteed here), but
// naming it explicitly beats re-deriving it in the render code too.
function generateFractionAdditionLevel3Exercise() {
  const ex = generateMultipleDenomLevel3Exercise(FRAC_ADD_L3_A_MIN, FRAC_ADD_L3_A_MAX, FRAC_ADD_L3_B_MIN, FRAC_ADD_L3_B_MAX, 0, 'add');
  const pIsExpandSide = ex.pDen !== ex.targetDenominator;
  const matchedNumerator = pIsExpandSide ? ex.qNum : ex.pNum;
  const expandedNumerator = ex.targetNumerator - matchedNumerator;
  return { ...ex, pIsExpandSide, expandedNumerator, answer: { expandedNumerator, targetNumerator: ex.targetNumerator } };
}

// Level 4 (was level 3 before the scaffold above was inserted 2026-08-25):
// p/a + q/(b*a) -- the second denominator is a multiple of the first, so the
// trick is expanding p/a to (p*b)/(b*a) and adding numerators: (p*b+q)/(b*a).
// FRAC_ADD_L3_B1_CHANCE (10%) of exercises use b=1, which collapses this into
// level 1's same-denominator mechanic (a = b*a) -- same fold-in idea as the
// "fractions" topic's level 5 b2=1 case. p and q are each drawn proper
// against their own shown denominator (p<a, q<b*a); q's range is then capped
// so p*b+q < b*a too (proper result, never a mixed number -- the game has no
// UI for those). Both shown fractions are also rejected unless already in
// lowest terms (gcd(p,a)=1, gcd(q,b*a)=1) -- otherwise q/(b*a) in particular
// would often look reducible on its own (e.g. 6/9) with no way for the
// student to act on that, since the blank only asks for the sum's numerator
// over the fixed denominator b*a; real textbook fraction problems always
// present givens already in simplest form. Also rejects gcd(p*b+q, b*a) !== 1,
// so like level 1 the result is always already reduced too -- no
// simplification step at this level either.
function generateFractionAdditionLevel4Exercise() {
  return generateMultipleDenomLevel3Exercise(FRAC_ADD_L3_A_MIN, FRAC_ADD_L3_A_MAX, FRAC_ADD_L3_B_MIN, FRAC_ADD_L3_B_MAX, FRAC_ADD_L3_B1_CHANCE, 'add');
}

// Level 5 (was level 4): same p/a + q/(b*a) setup as level 4, but
// FRAC_ADD_L4_REDUCTION_CHANCE (70%) of exercises force gcd(p*b+q, b*a) > 1,
// so the sum needs reducing -- same relationship level 2 has to level 1.
// Every exercise (both the reducible 70% and the already-reduced 30%)
// renders with missing: 'both', same uniform-blanks reasoning as level 2 --
// see that comment above. Because a and b*a are always in the
// a-divides-(b*a) relationship by construction (never independent
// denominators), levels 4-5 never require finding an LCD smaller than b*a --
// true LCD-finding with unrelated denominators is deferred to a future topic.
function generateFractionAdditionLevel5Exercise() {
  return generateMultipleDenomLevel4Exercise(FRAC_ADD_L3_A_MIN, FRAC_ADD_L3_A_MAX, FRAC_ADD_L3_B_MIN, FRAC_ADD_L3_B_MAX, FRAC_ADD_L3_B1_CHANCE, 'add', FRAC_ADD_L4_REDUCTION_CHANCE);
}

function generateFractionAdditionExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 5) {
    return generateFractionAdditionLevel5Exercise();
  }
  if (level === 4) {
    return generateFractionAdditionLevel4Exercise();
  }
  if (level === 3) {
    return generateFractionAdditionLevel3Exercise();
  }
  if (level === 2) {
    return generateFractionAdditionLevel2Exercise();
  }
  return generateFractionAdditionLevel1Exercise();
}

// True whenever the current exercise is the level 3 scaffold above -- its
// answer is {expandedNumerator, targetNumerator}, not the {numerator,
// denominator} shape every other addfractions/subtractfractions/fractions
// two-blank level uses, so it needs its own predicate (mirroring
// isAddFractionsAdvancedLevel1() etc. in exercise-addfractionsadvanced.js)
// wherever exercise-core.js needs to tell the two shapes apart.
function isFractionAdditionScaffoldLevel() {
  return gameMode === 'addfractions' && exerciseDifficultyIndex === 2;
}

// Dedicated checker for the level 3 scaffold (dispatched from checkAnswer()
// in exercise-core.js) -- mirrors checkFractionAdditionAdvancedLevel1Answer()
// in exercise-addfractionsadvanced.js structurally, but both #answer
// (expandedNumerator) and #answer2 (targetNumerator) are ordinary required
// digits here, never a "blank legitimately asserts 0" whole-number box, so
// there's no isWholeBoxAnswerLevel()-style exception to make for either one.
function checkFractionAdditionScaffoldAnswer() {
  if (gameOver) return;
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (answerInput.value.trim() === '' || answer2.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const isCorrect = parseInt(answerInput.value, 10) === currentAnswer.expandedNumerator &&
    parseInt(answer2.value, 10) === currentAnswer.targetNumerator;

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
