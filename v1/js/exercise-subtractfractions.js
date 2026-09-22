// ---------- Fraction-subtraction exercise (p/n - q/n = [?]/n, and variants) ----------
// Mirrors exercise-addfractions.js's structure -- see that file's header
// comment for the shared {pNum, pDen, qNum, qDen, missing, targetNumerator,
// targetDenominator, answer} shape newExercise() (exercise-core.js) renders.
// The actual generation lives in exercise-fraction-arithmetic.js, shared
// with exercise-addfractions.js -- see that file's header comment for why.

// Level 1: same-denominator subtraction, always a positive, proper,
// already-reduced result. p (the minuend) is drawn from [2, n-1] so there's
// room for a smaller q below it; q (the subtrahend) is drawn from [1, p-1]
// so it's always < p (positive result) and p<n already guarantees
// diff=p-q<n (proper result) with no extra check needed -- unlike addition's
// level 1, which has to draw the sum first to control that.
function generateFractionSubtractionLevel1Exercise() {
  return generateSameDenomLevel1Exercise(FRAC_SUB_DEN_MIN, FRAC_SUB_DEN_MAX, 'subtract');
}

// Level 2: same mechanic, but FRAC_SUB_L2_REDUCTION_CHANCE (70%) of the time
// the draw is forced so the diff/n result needs reducing. Every level-2
// exercise (both the 70% that need reducing and the 30% that don't) is
// rendered with missing: 'both', same uniform-blanks convention as
// addfractions level 2 -- see that comment in exercise-addfractions.js for
// why the shape must stay identical either way.
function generateFractionSubtractionLevel2Exercise() {
  return generateSameDenomLevel2Exercise(FRAC_SUB_DEN_MIN, FRAC_SUB_DEN_MAX, 'subtract', FRAC_SUB_L2_REDUCTION_CHANCE);
}

// Level 3: X = m/a and Y = k/(b*a) -- one denominator a multiple of the
// other, same idea as addfractions level 4 (addfractions has its own extra
// level 3 scaffold wedged in ahead of this mechanic, isolating the
// expand-to-common-denominator step on its own -- subtractfractions has no
// equivalent yet), but since subtraction isn't
// commutative there's no separate "which slot" swap needed the way addition
// had to add one: whichever fraction plays minuend lands in pNum/pDen (the
// shown left side of the "-") and whichever plays subtrahend lands in
// qNum/qDen, so randomizing minuend/subtrahend (baked into `minuendIsM` in
// exercise-fraction-arithmetic.js's drawMultipleDenomCandidate(), each 50%)
// already puts the fraction needing expansion (the one with denominator a,
// not b*a) on a random side -- see [[feedback_exercise_no_giveaway_design]].
// FRAC_SUB_L3_B1_CHANCE (10%) of exercises use b=1, folding into levels 1-2's
// same-denominator mechanic (a = b*a). Both shown fractions are drawn
// already in lowest terms (gcd(m,a)=1, gcd(k,b*a)=1). Rejects non-positive
// results and gcd(diff, b*a) !== 1, so like level 1 the result is always
// already reduced too -- no simplification step at this level either.
function generateFractionSubtractionLevel3Exercise() {
  return generateMultipleDenomLevel3Exercise(FRAC_SUB_L3_A_MIN, FRAC_SUB_L3_A_MAX, FRAC_SUB_L3_B_MIN, FRAC_SUB_L3_B_MAX, FRAC_SUB_L3_B1_CHANCE, 'subtract');
}

// Level 4: same X=m/a, Y=k/(b*a) setup as level 3 (identical a/b ranges,
// identical FRAC_SUB_L3_B1_CHANCE b=1 fold-in, identical minuend/subtrahend
// coin flip), but FRAC_SUB_L4_REDUCTION_CHANCE (70%) of exercises force
// gcd(diff, b*a) > 1, so the result needs reducing -- same
// reduction-needed relationship level 2 has to level 1, layered onto level
// 3's expand-to-common-denominator mechanic (mirrors addfractions level 5's
// relationship to level 4). Rendered with missing: 'both' like level 2.
function generateFractionSubtractionLevel4Exercise() {
  return generateMultipleDenomLevel4Exercise(FRAC_SUB_L3_A_MIN, FRAC_SUB_L3_A_MAX, FRAC_SUB_L3_B_MIN, FRAC_SUB_L3_B_MAX, FRAC_SUB_L3_B1_CHANCE, 'subtract', FRAC_SUB_L4_REDUCTION_CHANCE);
}

function generateFractionSubtractionExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 4) {
    return generateFractionSubtractionLevel4Exercise();
  }
  if (level === 3) {
    return generateFractionSubtractionLevel3Exercise();
  }
  if (level === 2) {
    return generateFractionSubtractionLevel2Exercise();
  }
  return generateFractionSubtractionLevel1Exercise();
}
