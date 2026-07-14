// ---------- Generic + number-exercise helpers ----------
function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gcd(x, y) {
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

function strikeDamage() {
  return randInt(STRIKE_MIN_DMG, STRIKE_MAX_DMG);
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pickNumbers() {
  const { tier1Threshold, tier2Threshold, hardPool } = getExerciseLevelConfig();
  const r = Math.random();
  let a, b;

  if (r < tier1Threshold) {
    const special = randChoice(LEVEL1_NUMS);
    const other = randInt(0, 10);
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
