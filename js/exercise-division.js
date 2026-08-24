// ---------- Division-intro exercise ("מבוא לחילוק") ----------
// Same tier logic as multiplication's own pickNumbers() (helpers.js) --
// same thresholds/pools from the shared EXERCISE_LEVEL_CONFIGS (division has
// only one level implemented so far, at index 0, which is exactly
// multiplication's own level-1 entry) -- except LEVEL1_NUMS/randInt(0,10)
// are swapped for their 0-excluding counterparts, so 0 is never drawn at all
// rather than drawn and rerolled: "a×[]=0" has no single correct answer (any
// b works), unlike multiplication's own level 1 where 0×6=0 is a normal
// answer. tier2's pools (LEVEL2_NUMS, NON_LEVEL1_NUMS) never contained 0 to
// begin with, so they're reused as-is.
function pickDivisionFactors() {
  const { tier1Threshold, tier2Threshold, hardPool } = getExerciseLevelConfig();
  const r = Math.random();
  let a, b;

  if (r < tier1Threshold) {
    const special = randChoice(DIVISION_LEVEL1_NUMS);
    const other = randInt(1, 10);
    [a, b] = Math.random() < 0.5 ? [special, other] : [other, special];
  } else if (r < tier2Threshold) {
    const special = randChoice(LEVEL2_NUMS);
    const other = randChoice(NON_LEVEL1_NUMS);
    [a, b] = Math.random() < 0.5 ? [special, other] : [other, special];
  } else {
    a = randChoice(hardPool);
    b = randChoice(hardPool);
  }

  return [a, b];
}

// Level 1: draws two nonzero factors (see pickDivisionFactors() above) and
// blanks one of them at random -- e.g. 2×[]=6 -- the missing-factor skill
// division is built on, without introducing the ÷ symbol itself yet.
function generateDivisionIntroExercise() {
  const [a, b] = pickDivisionFactors();
  const missing = Math.random() < 0.5 ? 'first' : 'second';
  return { num1: a, num2: b, missing, product: a * b, answer: missing === 'first' ? a : b };
}
