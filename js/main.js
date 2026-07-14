// ---------- Difficulty pickers, game start/end, and event wiring ----------
function updateDifficultyLabel() {
  document.getElementById('diffLabel').textContent = DIFFICULTIES[difficultyIndex];
  document.getElementById('diffDownBtn').disabled = difficultyIndex === 0;
  document.getElementById('diffUpBtn').disabled = difficultyIndex === DIFFICULTIES.length - 1;
}

function changeDifficulty(delta) {
  const next = difficultyIndex + delta;
  if (next < 0 || next >= DIFFICULTIES.length) return;
  difficultyIndex = next;
  updateDifficultyLabel();
}

function updateExerciseDifficultyLabel() {
  document.getElementById('exDiffLabel').textContent = EXERCISE_DIFFICULTIES[exerciseDifficultyIndex];
  document.getElementById('exDiffDownBtn').disabled = exerciseDifficultyIndex === 0;
  document.getElementById('exDiffUpBtn').disabled = exerciseDifficultyIndex === EXERCISE_DIFFICULTIES.length - 1;
}

function changeExerciseDifficulty(delta) {
  const next = exerciseDifficultyIndex + delta;
  if (next < 0 || next >= EXERCISE_DIFFICULTIES.length) return;
  exerciseDifficultyIndex = next;
  updateExerciseDifficultyLabel();
}

function formatLevelInfo() {
  const modeLabel = gameMode === 'fractions' ? 'שברים' : 'כפל';
  return `נושא: ${modeLabel} | מהירות: ${DIFFICULTIES[difficultyIndex]} | קושי תרגילים: ${EXERCISE_DIFFICULTIES[exerciseDifficultyIndex]}`;
}

function endGame(playerWon) {
  gameOver = true;
  clearInterval(intervalId);
  clearInterval(animIntervalId);
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlayTitle');
  title.textContent = playerWon ? '🏆 ניצחת!' : '💥 הפסדת';
  title.className = playerWon ? 'overlay-title win' : 'overlay-title lose';
  document.getElementById('overlayLevelInfo').textContent = formatLevelInfo();
  document.getElementById('overlayBattleTime').textContent = `משך הקרב: ${formatDuration(battleElapsedMs)}`;
  overlay.classList.add('show');
}

function startGame() {
  playerMoney = 0;
  playerCastleHP = CASTLE_MAX_HP;
  computerCastleHP = CASTLE_MAX_HP;
  soldiers = [];
  gameOver = false;
  enemySpawnTimer = 0;
  battleElapsedMs = 0;
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('levelInfo').textContent = formatLevelInfo();
  recalcSiegeThresholds();

  if (swapTimeoutId) clearTimeout(swapTimeoutId);
  document.getElementById('checkBtn').disabled = false;
  document.getElementById('answer').disabled = false;
  document.getElementById('answer2').disabled = false;
  document.getElementById('swapBtn').disabled = false;

  updateCoinsDisplay();
  render();
  newExercise();
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(tick, TICK_MS);
  if (animIntervalId) clearInterval(animIntervalId);
  animIntervalId = setInterval(animTick, ANIM_TICK_MS);
}

// ---------- Events ----------
document.getElementById('checkBtn').addEventListener('click', checkAnswer);
document.getElementById('answer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkAnswer();
});
document.getElementById('answer').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});
document.getElementById('answer2').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkAnswer();
});
document.getElementById('answer2').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});
document.getElementById('buyBtn').addEventListener('click', () => {
  buySoldier();
  document.getElementById('answer').focus();
});
document.getElementById('swapBtn').addEventListener('click', changeQuestion);
document.getElementById('surrenderBtn').addEventListener('click', () => {
  if (gameOver) return;
  endGame(false);
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
  startGame();
});
document.getElementById('changeDifficultyBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('startOverlay').classList.add('show');
});
document.getElementById('changeModeBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('modeOverlay').classList.add('show');
});
document.getElementById('modeMultiplyBtn').addEventListener('click', () => {
  gameMode = 'multiplication';
  document.getElementById('modeOverlay').classList.remove('show');
  document.getElementById('startOverlay').classList.add('show');
});
document.getElementById('modeFractionsBtn').addEventListener('click', () => {
  gameMode = 'fractions';
  document.getElementById('modeOverlay').classList.remove('show');
  document.getElementById('startOverlay').classList.add('show');
});
document.getElementById('backToModeBtn').addEventListener('click', () => {
  document.getElementById('startOverlay').classList.remove('show');
  document.getElementById('modeOverlay').classList.add('show');
});
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startOverlay').classList.remove('show');
  startGame();
});
document.getElementById('diffUpBtn').addEventListener('click', () => changeDifficulty(1));
document.getElementById('diffDownBtn').addEventListener('click', () => changeDifficulty(-1));
document.getElementById('exDiffUpBtn').addEventListener('click', () => changeExerciseDifficulty(1));
document.getElementById('exDiffDownBtn').addEventListener('click', () => changeExerciseDifficulty(-1));
window.addEventListener('resize', recalcSiegeThresholds);
updateDifficultyLabel();
updateExerciseDifficultyLabel();
preloadSoldierSprites();
preloadCastleSprites();
