// ---------- Fraction-subtraction exercise (p/n - q/n = [?]/n, and variants) ----------
// Mirrors exercise-addfractions.js's structure -- see that file's header
// comment for the shared {pNum, pDen, qNum, qDen, missing, targetNumerator,
// targetDenominator, answer} shape newExercise() (exercise-core.js) renders.

// Level 1: same-denominator subtraction, always a positive, proper,
// already-reduced result. p (the minuend numerator) is drawn from [2, n-1]
// so there's room for a smaller q below it; q (the subtrahend) is drawn from
// [1, p-1] so it's always < p (positive result) and p<n already guarantees
// diff=p-q<n (proper result) with no extra check needed -- unlike addition's
// level 1, which has to draw the sum first to control that. Rejects draws
// where gcd(diff, n) !== 1 so the result is always already reduced -- no
// simplification step at this level.
function generateFractionSubtractionLevel1Exercise() {
  let n, p, q, diff;
  do {
    n = randInt(FRAC_SUB_DEN_MIN, FRAC_SUB_DEN_MAX);
    p = randInt(2, n - 1);
    q = randInt(1, p - 1);
    diff = p - q;
  } while (gcd(diff, n) !== 1);

  return { pNum: p, pDen: n, qNum: q, qDen: n, missing: 'numerator', targetNumerator: diff, targetDenominator: n, answer: diff };
}

function generateFractionSubtractionExercise() {
  // Only level 1 exists so far -- more levels (reduction, expand-to-common-
  // denominator) to follow later, mirroring how addfractions grew across
  // several sessions (see js/exercise-addfractions.js).
  return generateFractionSubtractionLevel1Exercise();
}
