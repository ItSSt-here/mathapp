// ---------- Shared engine for addfractions/subtractfractions ----------
// exercise-addfractions.js and exercise-subtractfractions.js implement the
// exact same 4-level structure (same-denominator levels 1-2, then
// one-denominator-a-multiple-of-the-other levels 3-4) and return the exact
// same {pNum, pDen, qNum, qDen, missing, targetNumerator, targetDenominator,
// answer} shape -- the only real difference is the arithmetic itself:
// addition is commutative (any positive split of a target sum is valid, and
// which addend renders on which side is purely cosmetic), subtraction isn't
// (the draw has to know which fraction is the minuend before it can even
// tell whether the result is positive). `op` ('add'/'subtract') selects
// between the two draw strategies below; everything else (denominator
// draws, the reduction-chance rejection-sampling loop, building the
// returned object) is identical between the two topics and lives here once.

// Draws one same-denominator candidate pair (levels 1-2 of both topics).
// Addition draws the *target* (sum) first and splits it into p/q, since any
// split of a fixed sum into two positive parts is valid. Subtraction can't
// do that -- it draws the minuend (p) first, then a smaller subtrahend (q)
// below it, so the result is guaranteed positive.
function drawSameDenomCandidate(n, op) {
  if (op === 'add') {
    const target = randInt(2, n - 1);
    const p = randInt(1, target - 1);
    return { p, q: target - p, target };
  }
  const p = randInt(2, n - 1);
  const q = randInt(1, p - 1);
  return { p, q, target: p - q };
}

// Level 1: always already reduced (single blank numerator).
function generateSameDenomLevel1Exercise(denMin, denMax, op) {
  let n, p, q, target;
  do {
    n = randInt(denMin, denMax);
    ({ p, q, target } = drawSameDenomCandidate(n, op));
  } while (gcd(target, n) !== 1);
  return { pNum: p, pDen: n, qNum: q, qDen: n, missing: 'numerator', targetNumerator: target, targetDenominator: n, answer: target };
}

// Level 2: same draw, but `reductionChance` of the time the draw is forced
// so the result needs reducing -- always rendered with missing: 'both'
// regardless (see the level-2 comments in exercise-addfractions.js/
// exercise-subtractfractions.js for why the blank shape can't give this away).
function generateSameDenomLevel2Exercise(denMin, denMax, op, reductionChance) {
  const requireReduction = Math.random() < reductionChance;
  let n, p, q, target, g;
  do {
    n = randInt(denMin, denMax);
    ({ p, q, target } = drawSameDenomCandidate(n, op));
    g = gcd(target, n);
  } while (requireReduction ? g <= 1 : g !== 1);
  const targetNumerator = target / g;
  const targetDenominator = n / g;
  return { pNum: p, pDen: n, qNum: q, qDen: n, missing: 'both', targetNumerator, targetDenominator, answer: { numerator: targetNumerator, denominator: targetDenominator } };
}

// Draws one "one denominator (b*a) a multiple of the other (a)" candidate
// (levels 3-4 of both topics): m/a and k/(b*a). Addition caps k so m*b+k
// stays a proper fraction (<b*a); subtraction draws k freely and a random
// coin flip -- baked directly into `target`, since it decides which
// fraction is the minuend and therefore whether the result is even
// positive -- picks the direction. `minuendIsM` records that choice so the
// caller can place m/a and k/(b*a) on the correct side of the "−".
function drawMultipleDenomCandidate(a, b, op) {
  const denom = b * a;
  const m = randInt(1, a - 1);
  if (op === 'add') {
    const kMax = denom - b * m - 1;
    const k = kMax >= 1 ? randInt(1, kMax) : 0;
    return { m, k, denom, target: m * b + k, minuendIsM: true };
  }
  const k = randInt(1, denom - 1);
  const minuendIsM = Math.random() < 0.5;
  return { m, k, denom, target: minuendIsM ? b * m - k : k - b * m, minuendIsM };
}

// Places m/a and k/(b*a) into the shown pNum/pDen (left) and qNum/qDen
// (right) slots. For addition this is a free 50/50 cosmetic swap -- order
// never affects the sum, see [[feedback_exercise_no_giveaway_design]]. For
// subtraction, `minuendIsM` (decided back in drawMultipleDenomCandidate,
// since it affects the result's sign) already fixes which side is which;
// this just places it.
function orderMultipleDenomShown(m, a, k, denom, op, minuendIsM) {
  if (op === 'add') {
    return Math.random() < 0.5
      ? { pNum: k, pDen: denom, qNum: m, qDen: a }
      : { pNum: m, pDen: a, qNum: k, qDen: denom };
  }
  return minuendIsM
    ? { pNum: m, pDen: a, qNum: k, qDen: denom }
    : { pNum: k, pDen: denom, qNum: m, qDen: a };
}

// Level 3: always already reduced (single blank numerator). `k < 1` is only
// ever reachable for addition (a degenerate draw where kMax < 1); harmless
// as an always-false extra check for subtraction, where k is drawn >= 1 to
// begin with.
function generateMultipleDenomLevel3Exercise(aMin, aMax, bMin, bMax, b1Chance, op) {
  let a, b, m, k, denom, target, minuendIsM;
  do {
    a = randInt(aMin, aMax);
    b = Math.random() < b1Chance ? 1 : randInt(bMin, bMax);
    ({ m, k, denom, target, minuendIsM } = drawMultipleDenomCandidate(a, b, op));
  } while (target < 1 || k < 1 || gcd(m, a) !== 1 || gcd(k, denom) !== 1 || gcd(target, denom) !== 1);

  return { ...orderMultipleDenomShown(m, a, k, denom, op, minuendIsM), missing: 'numerator', targetNumerator: target, targetDenominator: denom, answer: target };
}

// Level 4: same draw as level 3, but `reductionChance` of the time forced so
// the result needs reducing -- same relationship level 2 has to level 1.
function generateMultipleDenomLevel4Exercise(aMin, aMax, bMin, bMax, b1Chance, op, reductionChance) {
  const requireReduction = Math.random() < reductionChance;
  let a, b, m, k, denom, target, minuendIsM, g;
  do {
    a = randInt(aMin, aMax);
    b = Math.random() < b1Chance ? 1 : randInt(bMin, bMax);
    ({ m, k, denom, target, minuendIsM } = drawMultipleDenomCandidate(a, b, op));
    g = gcd(target, denom);
  } while (target < 1 || k < 1 || gcd(m, a) !== 1 || gcd(k, denom) !== 1 || (requireReduction ? g <= 1 : g !== 1));

  const targetNumerator = target / g;
  const targetDenominator = denom / g;
  return { ...orderMultipleDenomShown(m, a, k, denom, op, minuendIsM), missing: 'both', targetNumerator, targetDenominator, answer: { numerator: targetNumerator, denominator: targetDenominator } };
}
