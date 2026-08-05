// ---------- Fraction-addition exercise (p/n + q/n = [?]/n) ----------

// Level 1: same-denominator addition, always a proper and already-reduced
// result -- n is drawn wide (3-20, see FRAC_ADD_DEN_MIN/MAX in config.js)
// since this topic comes after "שברים", where the student has already met
// many denominators. sum (=p+q) is drawn first from [2, n-1] so it's always
// < n (proper result), then split into p/q (each >=1). Rejects draws where
// gcd(sum, n) !== 1 so the result is always already reduced -- no
// simplification step at this level. missing/targetNumerator/targetDenominator
// are included (even though they never vary here) so newExercise() in
// exercise-core.js can treat both levels' return shape identically.
function generateFractionAdditionLevel1Exercise() {
  let n, sum;
  do {
    n = randInt(FRAC_ADD_DEN_MIN, FRAC_ADD_DEN_MAX);
    sum = randInt(2, n - 1);
  } while (gcd(sum, n) !== 1);

  const p = randInt(1, sum - 1);
  const q = sum - p;

  return { p, q, n, missing: 'numerator', targetNumerator: sum, targetDenominator: n, answer: sum };
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

  return { p, q, n, missing: 'both', targetNumerator, targetDenominator, answer: { numerator: targetNumerator, denominator: targetDenominator } };
}

function generateFractionAdditionExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 2) {
    return generateFractionAdditionLevel2Exercise();
  }
  return generateFractionAdditionLevel1Exercise();
}
