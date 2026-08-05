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

// Level 2: same mechanic, but FRAC_SUB_L2_REDUCTION_CHANCE (70%) of the time
// the draw is forced so gcd(diff, n) > 1 -- the diff/n result needs reducing.
// Every level-2 exercise (both the 70% that need reducing and the 30% that
// don't) is rendered with missing: 'both', same uniform-blanks convention as
// addfractions level 2 -- see that comment in exercise-addfractions.js for
// why the shape must stay identical either way.
function generateFractionSubtractionLevel2Exercise() {
  const requireReduction = Math.random() < FRAC_SUB_L2_REDUCTION_CHANCE;
  let n, p, q, diff, g;
  do {
    n = randInt(FRAC_SUB_DEN_MIN, FRAC_SUB_DEN_MAX);
    p = randInt(2, n - 1);
    q = randInt(1, p - 1);
    diff = p - q;
    g = gcd(diff, n);
  } while (requireReduction ? g <= 1 : g !== 1);

  const targetNumerator = diff / g;
  const targetDenominator = n / g;

  return { pNum: p, pDen: n, qNum: q, qDen: n, missing: 'both', targetNumerator, targetDenominator, answer: { numerator: targetNumerator, denominator: targetDenominator } };
}

// Level 3: X = m/a and Y = k/(b*a) -- one denominator a multiple of the
// other, same idea as addfractions level 3, but since subtraction isn't
// commutative there's no separate "which slot" swap needed the way addition
// had to add one: whichever fraction plays minuend lands in pNum/pDen (the
// shown left side of the "-") and whichever plays subtrahend lands in
// qNum/qDen, so randomizing minuend/subtrahend (caseA: X-Y, else Y-X, each
// 50%) already puts the fraction needing expansion (the one with
// denominator a, not b*a) on a random side -- see
// [[feedback_exercise_no_giveaway_design]]. FRAC_SUB_L3_B1_CHANCE (10%) of
// exercises use b=1, folding into levels 1-2's same-denominator mechanic
// (a = b*a). Both shown fractions are drawn already in lowest terms
// (gcd(m,a)=1, gcd(k,b*a)=1). Rejects non-positive results and
// gcd(diff, b*a) !== 1, so like level 1 the result is always already
// reduced too -- no simplification step at this level either.
function generateFractionSubtractionLevel3Exercise() {
  let a, b, m, k, denom, caseA, diff;
  do {
    a = randInt(FRAC_SUB_L3_A_MIN, FRAC_SUB_L3_A_MAX);
    b = Math.random() < FRAC_SUB_L3_B1_CHANCE ? 1 : randInt(FRAC_SUB_L3_B_MIN, FRAC_SUB_L3_B_MAX);
    m = randInt(1, a - 1);
    denom = b * a;
    k = randInt(1, denom - 1);
    caseA = Math.random() < 0.5;
    diff = caseA ? b * m - k : k - b * m;
  } while (diff < 1 || gcd(m, a) !== 1 || gcd(k, denom) !== 1 || gcd(diff, denom) !== 1);

  return caseA
    ? { pNum: m, pDen: a, qNum: k, qDen: denom, missing: 'numerator', targetNumerator: diff, targetDenominator: denom, answer: diff }
    : { pNum: k, pDen: denom, qNum: m, qDen: a, missing: 'numerator', targetNumerator: diff, targetDenominator: denom, answer: diff };
}

// Level 4: same X=m/a, Y=k/(b*a) setup as level 3 (identical a/b ranges,
// identical FRAC_SUB_L3_B1_CHANCE b=1 fold-in, identical caseA minuend/
// subtrahend coin flip), but FRAC_SUB_L4_REDUCTION_CHANCE (70%) of exercises
// force gcd(diff, b*a) > 1, so the result needs reducing -- same
// reduction-needed relationship level 2 has to level 1, layered onto level
// 3's expand-to-common-denominator mechanic (mirrors addfractions level 4's
// relationship to level 3). Rendered with missing: 'both' like level 2.
function generateFractionSubtractionLevel4Exercise() {
  const requireReduction = Math.random() < FRAC_SUB_L4_REDUCTION_CHANCE;
  let a, b, m, k, denom, caseA, diff, g;
  do {
    a = randInt(FRAC_SUB_L3_A_MIN, FRAC_SUB_L3_A_MAX);
    b = Math.random() < FRAC_SUB_L3_B1_CHANCE ? 1 : randInt(FRAC_SUB_L3_B_MIN, FRAC_SUB_L3_B_MAX);
    m = randInt(1, a - 1);
    denom = b * a;
    k = randInt(1, denom - 1);
    caseA = Math.random() < 0.5;
    diff = caseA ? b * m - k : k - b * m;
    g = diff >= 1 ? gcd(diff, denom) : 1;
  } while (diff < 1 || gcd(m, a) !== 1 || gcd(k, denom) !== 1 || (requireReduction ? g <= 1 : g !== 1));

  const targetNumerator = diff / g;
  const targetDenominator = denom / g;

  return caseA
    ? { pNum: m, pDen: a, qNum: k, qDen: denom, missing: 'both', targetNumerator, targetDenominator, answer: { numerator: targetNumerator, denominator: targetDenominator } }
    : { pNum: k, pDen: denom, qNum: m, qDen: a, missing: 'both', targetNumerator, targetDenominator, answer: { numerator: targetNumerator, denominator: targetDenominator } };
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
