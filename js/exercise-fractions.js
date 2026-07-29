// ---------- Fractions exercise (reduce/expand to a missing numerator/denominator) ----------

// Picks a reduced fraction c/a and its unreduced equivalent (b*c)/(b*a) --
// c is coprime with a, so the two are genuinely the same fraction. Which of
// the two is shown fully ("direction") and which component(s) of the other
// one are hidden ("missing") depends on the exercise difficulty level:
//   level 1: always reduction, missing numerator       (b*c)/(b*a) = [?]/a
//   level 2: direction randomized, missing numerator   either of the above two
//   level 3: direction AND missing component randomized, all 4 combos
//   level 4: mostly a full independent reduction with both numerator and
//     denominator blank, occasionally mixing in level 3's single-blank
//     format for variety. (Level 5 has its own generator, see below.)
function pickFractionMode(level) {
  if (level === 1) {
    return { direction: 'reduction', missing: 'numerator' };
  }
  if (level === 2) {
    return { direction: randChoice(['reduction', 'expansion']), missing: 'numerator' };
  }
  if (level === 3) {
    return { direction: randChoice(['reduction', 'expansion']), missing: randChoice(['numerator', 'denominator']) };
  }
  if (Math.random() < FRACTION_LEVEL4_FULL_REDUCTION_CHANCE) {
    return { direction: 'reduction', missing: 'both' };
  }
  return pickFractionMode(3);
}

// Level 5: shows the unreduced (b*c)/(b*a) fully (never the reduced c/a),
// alongside a second unreduced fraction built from an independent inflation
// factor b2 (b2 != b), with one component of that second fraction hidden.
// Neither shown fraction is in reduced form, so the student has to reason
// about the ratio between the two directly rather than reduce to c/a first.
// b2's range starts at 1 (b's starts at 2) -- b2=1 makes the second fraction
// c/a itself, which folds level 3-style exercises in as a natural subset.
function generateLevel5Exercise(a, b, c) {
  const b2Max = a <= FRACTION_TARGET_DEN_SPLIT ? FRACTION_FACTOR_LOW_MAX : FRACTION_FACTOR_HIGH_MAX;
  let b2;
  do {
    b2 = randInt(FRACTION_B2_MIN, b2Max);
  } while (b2 === b);

  const shownNumerator = b * c;
  const shownDenominator = b * a;
  const targetNumerator = b2 * c;
  const targetDenominator = b2 * a;
  const missing = randChoice(['numerator', 'denominator']);
  const answer = missing === 'numerator' ? targetNumerator : targetDenominator;

  return { shownNumerator, shownDenominator, targetNumerator, targetDenominator, missing, answer };
}

function generateFractionExercise() {
  const a = randInt(FRACTION_TARGET_DEN_MIN, FRACTION_TARGET_DEN_MAX);
  const b = a <= FRACTION_TARGET_DEN_SPLIT
    ? randInt(FRACTION_FACTOR_LOW_MIN, FRACTION_FACTOR_LOW_MAX)
    : randInt(FRACTION_FACTOR_HIGH_MIN, FRACTION_FACTOR_HIGH_MAX);
  let c;
  do {
    c = randInt(1, a - 1);
  } while (gcd(c, a) !== 1);

  const level = exerciseDifficultyIndex + 1;

  if (level === 5) {
    return generateLevel5Exercise(a, b, c);
  }

  const { direction, missing } = pickFractionMode(level);

  // "reduction" shows the unreduced fraction and targets the reduced one;
  // "expansion" shows the reduced fraction and targets the unreduced one.
  const shownNumerator = direction === 'reduction' ? b * c : c;
  const shownDenominator = direction === 'reduction' ? b * a : a;
  const targetNumerator = direction === 'reduction' ? c : b * c;
  const targetDenominator = direction === 'reduction' ? a : b * a;
  const answer = missing === 'both'
    ? { numerator: targetNumerator, denominator: targetDenominator }
    : (missing === 'numerator' ? targetNumerator : targetDenominator);

  return { shownNumerator, shownDenominator, targetNumerator, targetDenominator, missing, answer };
}
