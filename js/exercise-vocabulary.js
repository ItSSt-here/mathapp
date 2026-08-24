// ---------- Vocabulary exercise ----------
// Level 1 (only level implemented so far): an English word is shown and the
// student picks its Hebrew translation out of up to 5 options -- see
// generateVocabularyExercise()/renderVocabularyChoices()/checkVocabularyAnswer()
// below and the isVocabulary branch in newExercise() (exercise-core.js).

// Holds the currently loaded list: array of {en, he}. Populated by
// parseVocabularyWordList() when the teacher/student loads a list on
// vocabularyWordsOverlay, or by parseUrlParams() (main.js) when arriving via
// a teacher-shared link that already carries one.
let vocabularyWordList = [];

// Correct answer (Hebrew normally, English in reverse mode) for whatever
// exercise is currently on screen.
let currentVocabularyAnswer = null;

// Level 2: shows the Hebrew word and the choices are English -- same list,
// same mechanic, just which side of each {en, he} pair is the prompt vs. the
// answer. Same "level >= 1 flips prompt/answer direction" idea as
// isLetterReverseMode() (exercise-letters.js), just a single level here
// since vocabulary only has the two.
function isVocabularyReverseMode() {
  return gameMode === 'vocabulary' && exerciseDifficultyIndex === 1;
}

// One word pair per line, English and Hebrew separated by ';' (e.g.
// "apple;תפוח"). Blank lines and lines missing the separator or either side
// are silently skipped and counted as errors rather than rejecting the whole
// list -- lets a mostly-good pasted list still load instead of forcing the
// teacher to track down one bad line before anything works.
function parseVocabularyWordList(rawText) {
  const pairs = [];
  let errorCount = 0;
  for (const line of rawText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sepIndex = trimmed.indexOf(';');
    if (sepIndex === -1) { errorCount++; continue; }
    const en = trimmed.slice(0, sepIndex).trim();
    const he = trimmed.slice(sepIndex + 1).trim();
    if (!en || !he) { errorCount++; continue; }
    pairs.push({ en, he });
  }
  return { pairs, errorCount };
}

// Inverse of parseVocabularyWordList() -- used by buildShareLink() (main.js)
// to embed the currently-loaded list into a teacher-shared link, and by
// saveVocabularyWordListToStorage() below for the same "en;he per line" text
// form in localStorage.
function serializeVocabularyWordList(list) {
  return list.map(w => `${w.en};${w.he}`).join('\n');
}

// This device's "last used" vocabulary list -- read back only to pre-fill
// the paste textarea (modeVocabularyBtn's handler, main.js) when it's
// opened, never to skip a screen or auto-start a game on its own. That
// distinction matters: the same bare app URL is opened by both a student
// wanting to resume instantly and a teacher wanting to author something new,
// and those two want opposite default behavior -- pre-filling a visible,
// editable textarea serves both (one clicks "המשך" immediately, the other
// edits or replaces it) without favoring either. See
// [[project_vocabulary_topic_plan]]. Written any time a list is actually
// loaded, successfully, from either source: parseUrlParams() (a real
// teacher link) or loadVocabularyWordsFromTextarea() (typed/pasted/file, via
// "טען רשימה" or "המשך").
const VOCABULARY_STORAGE_KEY = 'mathapp_vocabulary_list';

function saveVocabularyWordListToStorage(list) {
  localStorage.setItem(VOCABULARY_STORAGE_KEY, serializeVocabularyWordList(list));
}

function loadVocabularyWordListFromStorage() {
  return localStorage.getItem(VOCABULARY_STORAGE_KEY) || '';
}

// Picks a random word as the target and up to 4 *other* words' Hebrew
// translations from the same list as distractors (see
// [[project_vocabulary_topic_plan]] -- v1 draws distractors from the same
// list rather than a separate pool). A list shorter than 5 words shows fewer
// options instead of padding with duplicates -- there's nothing else honest
// to fill the remaining slots with, and vocabularyContinueBtn (main.js)
// already refuses to start a round with fewer than 2 words total.
function generateVocabularyExercise() {
  const reverse = isVocabularyReverseMode();
  const promptField = reverse ? 'he' : 'en';
  const answerField = reverse ? 'en' : 'he';
  const target = randChoice(vocabularyWordList);
  const distractorPool = vocabularyWordList.filter(w => w[answerField] !== target[answerField]);
  const distractorCount = Math.min(4, distractorPool.length);
  const distractors = pickDistinctRandom(distractorPool, distractorCount).map(w => w[answerField]);
  const options = pickDistinctRandom([target[answerField], ...distractors], distractorCount + 1); // shuffles the order too
  return { word: target[promptField], correct: target[answerField], options, reverse };
}

function renderVocabularyChoices(ex) {
  const wordDisplay = document.getElementById('vocabularyWordDisplay');
  wordDisplay.textContent = ex.word;
  // The prompt word is normally English (LTR) inside this RTL page --
  // .vocabulary-word-display hardcodes ltr for that. Reverse mode's prompt
  // is Hebrew instead, so it needs the page's own rtl direction back.
  wordDisplay.classList.toggle('vocabulary-word-display-reverse', ex.reverse);
  const container = document.getElementById('vocabularyChoices');
  container.innerHTML = '';
  container.classList.remove('vocabulary-choices-locked');
  ex.options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vocabulary-choice-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => checkVocabularyAnswer(option, ex.correct, btn));
    container.appendChild(btn);
  });
  if (container.firstElementChild) container.firstElementChild.focus();
}

// Wrong pick: that option is eliminated (stays disabled) and the same
// question continues with the remaining options -- same retry pattern as
// checkLetterAnswer() (exercise-letters.js). Kept as its own copy rather than
// sharing that function directly, since vocabulary has no sound button or
// reverse-mode branching to thread through.
function checkVocabularyAnswer(selected, correct, btnEl) {
  if (gameOver) return;

  const container = document.getElementById('vocabularyChoices');
  if (container.classList.contains('vocabulary-choices-locked')) return;

  const feedback = document.getElementById('feedback');
  const isCorrect = selected === correct;

  container.classList.add('vocabulary-choices-locked');
  Array.from(container.children).forEach(b => b.disabled = true);

  if (isCorrect) {
    btnEl.classList.add('vocabulary-correct');
    markCorrect(btnEl);
    setTimeout(newExercise, 800);
  } else {
    btnEl.classList.add('vocabulary-wrong');
    markWrong(btnEl);
    setTimeout(() => {
      Array.from(container.children).forEach(b => { if (b !== btnEl) b.disabled = false; });
      container.classList.remove('vocabulary-choices-locked');
      feedback.textContent = '';
      feedback.className = 'feedback';
      // Disabling btnEl above force-blurred it (a disabled button can't hold
      // focus) -- without this, keyboard focus is left on nothing at all once
      // the retry window reopens, stranding a keyboard-only player.
      const target = container.querySelector('button:not(:disabled)');
      if (target) target.focus();
    }, 800);
  }
}
