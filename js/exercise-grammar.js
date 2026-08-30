// ---------- Grammar exercise ----------
// Level 1 (the only level so far): an English word (V1, e.g. a verb's base
// form) is shown and the student types V2 (e.g. its past-tense form) with
// exact spelling -- no multiple choice. Structurally this is vocabulary
// level 4 (isVocabularyTypedMode()) lifted out into its own topic: same
// word-list-rides-in-the-link mechanism, same typed-answer/checkBtn flow,
// same "החלף שאלה" swap-to-reveal escape hatch, just its own pair meaning
// (V1/V2, not english/hebrew) and only ever one direction/level for now. See
// generateGrammarExercise()/renderGrammarExercise()/checkGrammarAnswer()
// below and the isGrammar branch in newExercise() (exercise-core.js).

// Holds the currently loaded list: array of {v1, v2}. Populated by
// parseGrammarWordList() when the teacher/student loads a list on
// grammarWordsOverlay, or by parseUrlParams() (main.js) when arriving via a
// teacher-shared link that already carries one.
let grammarWordList = [];

// Correct answer (V2) for whatever exercise is currently on screen.
let currentGrammarAnswer = null;

// One word pair per line, V1 and V2 separated by ';' (e.g. "go;went").
// Blank lines and lines missing the separator or either side are silently
// skipped and counted as errors rather than rejecting the whole list --
// same reasoning as parseVocabularyWordList() (exercise-vocabulary.js).
function parseGrammarWordList(rawText) {
  const pairs = [];
  let errorCount = 0;
  for (const line of rawText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sepIndex = trimmed.indexOf(';');
    if (sepIndex === -1) { errorCount++; continue; }
    const v1 = trimmed.slice(0, sepIndex).trim();
    const v2 = trimmed.slice(sepIndex + 1).trim();
    if (!v1 || !v2) { errorCount++; continue; }
    pairs.push({ v1, v2 });
  }
  return { pairs, errorCount };
}

// Inverse of parseGrammarWordList() -- used by buildShareLink() (main.js) to
// embed the currently-loaded list into a teacher-shared link, and by
// saveGrammarWordListToStorage() below for the same "v1;v2 per line" text
// form in localStorage.
function serializeGrammarWordList(list) {
  return list.map(w => `${w.v1};${w.v2}`).join('\n');
}

// This device's "last used" grammar list -- read back only to pre-fill the
// paste textarea (modeGrammarBtn's handler, main.js) when it's opened, same
// link-wins/localStorage-only-prefills reasoning as
// [[project_vocabulary_topic_plan]].
const GRAMMAR_STORAGE_KEY = 'mathapp_grammar_list';

function saveGrammarWordListToStorage(list) {
  localStorage.setItem(GRAMMAR_STORAGE_KEY, serializeGrammarWordList(list));
}

function loadGrammarWordListFromStorage() {
  return localStorage.getItem(GRAMMAR_STORAGE_KEY) || '';
}

// Picks a random pair and shows V1, answer is V2. No distractor pool to
// build -- this topic is typed-only, never multiple-choice.
function generateGrammarExercise() {
  const target = randChoice(grammarWordList);
  return { word: target.v1, correct: target.v2 };
}

function renderGrammarExercise(ex) {
  const wordDisplay = document.getElementById('grammarWordDisplay');
  const input = document.getElementById('grammarTypedInput');
  wordDisplay.textContent = ex.word;
  input.value = '';
  input.disabled = false;
  // A previous round's "החלף שאלה" reveal (changeGrammarQuestion() below)
  // leaves this class on -- clear it so a fresh round doesn't start
  // pre-styled as a revealed answer.
  input.classList.remove('answer-revealed');
  input.focus();
}

// Case-insensitive and collapses whitespace, otherwise an exact match -- the
// user wants spelling checked perfectly, so no partial credit or fuzzy/
// near-miss leniency. Same normalization as
// normalizeVocabularyTypedAnswer() (exercise-vocabulary.js).
function normalizeGrammarTypedAnswer(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Dispatched from checkAnswer() (exercise-core.js) via its
// gameMode === 'grammar' branch -- same shared checkBtn/Enter-to-submit flow
// every typed-answer topic uses.
function checkGrammarAnswer() {
  if (gameOver) return;

  const input = document.getElementById('grammarTypedInput');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (input.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const isCorrect = normalizeGrammarTypedAnswer(input.value) === normalizeGrammarTypedAnswer(currentGrammarAnswer);

  checkBtn.disabled = true;
  input.disabled = true;

  if (isCorrect) {
    markCorrect(input);
    setTimeout(() => {
      checkBtn.disabled = false;
      input.disabled = false;
      newExercise();
    }, 800);
  } else {
    markWrong(input);
    setTimeout(() => {
      input.value = '';
      input.disabled = false;
      checkBtn.disabled = false;
      input.focus();
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}

// Dispatched from changeQuestion() (exercise-core.js) the same way
// checkGrammarAnswer() is dispatched from checkAnswer(), since this topic's
// answer lives in #grammarTypedInput rather than the generic
// #answer/#answer2/#answer3 changeQuestion() otherwise operates on. Same
// cost/timing/counters as every other topic's swap (SWAP_QUESTION_COST,
// SWAP_REVEAL_MS, swapCount, swapTimeoutId -- all shared globals from
// exercise-core.js/config.js), just revealing into a different element.
function changeGrammarQuestion() {
  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const input = document.getElementById('grammarTypedInput');
  if (swapBtn.disabled) return; // already mid-reveal

  playerMoney -= SWAP_QUESTION_COST;
  swapCount++;
  recordWeakPoolSwap();
  updateCoinsDisplay();
  updateStatsCountersDisplay();
  showFloatingText(`-${SWAP_QUESTION_COST}`, 'negative', swapBtn);

  swapBtn.disabled = true;
  checkBtn.disabled = true;
  input.disabled = true;
  input.value = currentGrammarAnswer;
  input.classList.add('answer-revealed');

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  swapTimeoutId = setTimeout(() => {
    checkBtn.disabled = false;
    input.disabled = false;
    swapBtn.disabled = false;
    newExercise(); // renderGrammarExercise() clears .answer-revealed for the new round
  }, SWAP_REVEAL_MS);
}
