// ---------- Fraction-addition exercise (p/n + q/n = [?]/n, and variants) ----------
// Every level's generator returns {pNum, pDen, qNum, qDen, missing,
// targetNumerator, targetDenominator, answer} -- newExercise() in
// exercise-core.js renders pNum/pDen and qNum/qDen as the two shown addends
// regardless of whether they share a denominator (levels 1-2) or not
// (level 3), and fills the blank(s) from missing/targetNumerator/targetDenominator.

// Level 1: same-denominator addition, always a proper and already-reduced
// result -- n is drawn wide (3-20, see FRAC_ADD_DEN_MIN/MAX in config.js)
// since this topic comes after "שברים", where the student has already met
// many denominators. sum (=p+q) is drawn first from [2, n-1] so it's always
// < n (proper result), then split into p/q (each >=1). Rejects draws where
// gcd(sum, n) !== 1 so the result is always already reduced -- no
// simplification step at this level.
function generateFractionAdditionLevel1Exercise() {
  let n, sum;
  do {
    n = randInt(FRAC_ADD_DEN_MIN, FRAC_ADD_DEN_MAX);
    sum = randInt(2, n - 1);
  } while (gcd(sum, n) !== 1);

  const p = randInt(1, sum - 1);
  const q = sum - p;

  return { pNum: p, pDen: n, qNum: q, qDen: n, missing: 'numerator', targetNumerator: sum, targetDenominator: n, answer: sum };
}

// Level 2: same mechanic, but FRAC_ADD_L2_REDUCTION_CHANCE (70%) of the time
// the draw is forced so gcd(sum, n) > 1 -- the sum/n result needs reducing.
// Every level-2 exercise (both the 70% that need reducing and the 30% that
// don't) is rendered with missing: 'both' -- numerator AND denominator
// blanked, same convention as the "fractions" topic's full-reduction
// exercises, including the "צמצם ככל הניתן" label -- see newExercise().
// Deliberately uniform: if only the reducible 70% got two blanks and the
// other 30% got level 1's single blank, the number of blanks alone (and
// therefore the label's presence) would give away whether reduction is
// needed before the student even does the math. In the 30% case
// targetNumerator/targetDenominator just come out equal to sum/n unchanged
// (g === 1), so the student's "reduced" answer is the sum itself -- there's
// nothing to actually simplify, but the blank shape looks identical either way.
function generateFractionAdditionLevel2Exercise() {
  const requireReduction = Math.random() < FRAC_ADD_L2_REDUCTION_CHANCE;
  let n, sum, g;
  do {
    n = randInt(FRAC_ADD_DEN_MIN, FRAC_ADD_DEN_MAX);
    sum = randInt(2, n - 1);
    g = gcd(sum, n);
  } while (requireReduction ? g <= 1 : g !== 1);

  const p = randInt(1, sum - 1);
  const q = sum - p;
  const targetNumerator = sum / g;
  const targetDenominator = n / g;

  return { pNum: p, pDen: n, qNum: q, qDen: n, missing: 'both', targetNumerator, targetDenominator, answer: { numerator: targetNumerator, denominator: targetDenominator } };
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
  let a, b, p, q, denom, sum;
  do {
    a = randInt(FRAC_ADD_L3_A_MIN, FRAC_ADD_L3_A_MAX);
    b = Math.random() < FRAC_ADD_L3_B1_CHANCE ? 1 : randInt(FRAC_ADD_L3_B_MIN, FRAC_ADD_L3_B_MAX);
    p = randInt(1, a - 1);
    denom = b * a;
    const qMax = denom - b * p - 1; // keeps p*b+q < b*a (proper result)
    q = qMax >= 1 ? randInt(1, qMax) : 0;
    sum = p * b + q;
  } while (q < 1 || gcd(p, a) !== 1 || gcd(q, denom) !== 1 || gcd(sum, denom) !== 1);

  return { pNum: p, pDen: a, qNum: q, qDen: denom, missing: 'numerator', targetNumerator: sum, targetDenominator: denom, answer: sum };
}

function generateFractionAdditionExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 3) {
    return generateFractionAdditionLevel3Exercise();
  }
  if (level === 2) {
    return generateFractionAdditionLevel2Exercise();
  }
  return generateFractionAdditionLevel1Exercise();
}
