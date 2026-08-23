// ---------- Fraction-addition exercise (p/n + q/n = [?]/n, and variants) ----------
// Every level's generator returns {pNum, pDen, qNum, qDen, missing,
// targetNumerator, targetDenominator, answer} -- newExercise() in
// exercise-core.js renders pNum/pDen and qNum/qDen as the two shown addends
// regardless of whether they share a denominator (levels 1-2) or not
// (levels 3-4), and fills the blank(s) from missing/targetNumerator/targetDenominator.
// The actual generation lives in exercise-fraction-arithmetic.js, shared with
// exercise-subtractfractions.js -- see that file's header comment for why.

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

// Level 3: p/a + q/(b*a) -- the second denominator is a multiple of the
// first, so the trick is expanding p/a to (p*b)/(b*a) and adding numerators:
// (p*b+q)/(b*a). FRAC_ADD_L3_B1_CHANCE (10%) of exercises use b=1, which
// collapses this into level 1's same-denominator mechanic (a = b*a) -- same
// fold-in idea as the "fractions" topic's level 5 b2=1 case. p and q are
// each drawn proper against their own shown denominator (p<a, q<b*a); q's
// range is then capped so p*b+q < b*a too (proper result, never a mixed
// number -- the game has no UI for those). Both shown fractions are also
// rejected unless already in lowest terms (gcd(p,a)=1, gcd(q,b*a)=1) --
// otherwise q/(b*a) in particular would often look reducible on its own
// (e.g. 6/9) with no way for the student to act on that, since the blank
// only asks for the sum's numerator over the fixed denominator b*a; real
// textbook fraction problems always present givens already in simplest
// form. Also rejects gcd(p*b+q, b*a) !== 1, so like level 1 the result is
// always already reduced too -- no simplification step at this level either.
function generateFractionAdditionLevel3Exercise() {
  return generateMultipleDenomLevel3Exercise(FRAC_ADD_L3_A_MIN, FRAC_ADD_L3_A_MAX, FRAC_ADD_L3_B_MIN, FRAC_ADD_L3_B_MAX, FRAC_ADD_L3_B1_CHANCE, 'add');
}

// Level 4: same p/a + q/(b*a) setup as level 3 (identical a/b ranges,
// identical FRAC_ADD_L3_B1_CHANCE b=1 fold-in), but FRAC_ADD_L4_REDUCTION_CHANCE
// (70%) of exercises force gcd(p*b+q, b*a) > 1, so the sum needs reducing --
// same relationship level 2 has to level 1. Every exercise (both the
// reducible 70% and the already-reduced 30%) renders with missing: 'both',
// same uniform-blanks reasoning as level 2 -- see that comment above.
// Because a and b*a are always in the a-divides-(b*a) relationship by
// construction (never independent denominators), levels 3-4 never require
// finding an LCD smaller than b*a -- true LCD-finding with unrelated
// denominators is deferred to a future topic.
function generateFractionAdditionLevel4Exercise() {
  return generateMultipleDenomLevel4Exercise(FRAC_ADD_L3_A_MIN, FRAC_ADD_L3_A_MAX, FRAC_ADD_L3_B_MIN, FRAC_ADD_L3_B_MAX, FRAC_ADD_L3_B1_CHANCE, 'add', FRAC_ADD_L4_REDUCTION_CHANCE);
}

function generateFractionAdditionExercise() {
  const level = exerciseDifficultyIndex + 1;
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
