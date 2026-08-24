// ---------- Vocabulary exercise ----------
// Level 1: an English word is shown and the student picks its Hebrew
// translation out of up to 5 options. Level 2 (isVocabularyReverseMode()):
// same mechanic, prompt/answer language flipped. Level 3
// (isVocabularyListenMode()): level 1's direction again, but the English
// word is spoken via TTS instead of shown as text. Level 4
// (isVocabularyTypedMode()): level 2's direction (Hebrew shown) but the
// answer is typed English text, checked via the shared checkBtn instead of
// a multiple-choice pick -- see checkVocabularyTypedAnswer(). See
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

// Level 3: same forward "pick the Hebrew translation" direction as level 1,
// except the English prompt is spoken via the browser's built-in TTS
// instead of shown as text. Recorded clips (used for letters/abc/nikud, see
// [[feedback_hebrew_letter_audio]]) aren't an option here: that pipeline
// covers a fixed 22-26 letter set worth recording once, but vocabulary
// lists are open-ended and teacher-supplied (no backend), so there's no
// fixed word set to pre-record. TTS was rejected for Hebrew three times
// (unreliable voice availability, homograph misreadings, a licensing wall)
// but none of that applies to English -- voice availability is solid and
// there's no homograph problem -- which is why this exists only for the
// English side and Hebrew never gets a spoken-prompt mode.
function isVocabularyListenMode() {
  return gameMode === 'vocabulary' && exerciseDifficultyIndex === 2;
}

// Level 4: same prompt direction as level 2 (Hebrew shown) but the answer is
// typed English text instead of a multiple-choice pick -- checked via the
// shared checkBtn/checkAnswer() dispatcher (exercise-core.js), same as every
// numeric topic, rather than vocabulary's own click-a-button
// checkVocabularyAnswer(). See checkVocabularyTypedAnswer() below.
function isVocabularyTypedMode() {
  return gameMode === 'vocabulary' && exerciseDifficultyIndex === 3;
}

// The word level 3's sound button should (re)play -- set by
// renderVocabularyChoices() each round, read by vocabularySoundBtn's click
// handler (main.js), same "persist outside the render function" need as
// currentLetterAnswer (exercise-letters.js).
let currentVocabularySpokenWord = null;

function speakVocabularyWord(word) {
  if (!word || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // cut off a rapid repeat tap, same reasoning as playLetterSound() (exercise-letters.js)
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
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
  const typed = isVocabularyTypedMode();
  // Typed mode (level 4) shows the Hebrew word, same direction as reverse
  // mode (level 2) -- they share the "prompt is Hebrew" word-display styling
  // in renderVocabularyChoices() below, even though only reverse mode is
  // multiple-choice.
  const reverse = isVocabularyReverseMode() || typed;
  const listen = isVocabularyListenMode();
  const promptField = reverse ? 'he' : 'en';
  const answerField = reverse ? 'en' : 'he';
  const target = randChoice(vocabularyWordList);
  // Typed mode has no options to build -- any other word in the list is a
  // legitimate distractor for multiple-choice, but free text has nothing
  // analogous to skip computing here.
  if (typed) {
    return { word: target[promptField], correct: target[answerField], options: null, reverse, listen, typed };
  }
  const distractorPool = vocabularyWordList.filter(w => w[answerField] !== target[answerField]);
  const distractorCount = Math.min(4, distractorPool.length);
  const distractors = pickDistinctRandom(distractorPool, distractorCount).map(w => w[answerField]);
  const options = pickDistinctRandom([target[answerField], ...distractors], distractorCount + 1); // shuffles the order too
  return { word: target[promptField], correct: target[answerField], options, reverse, listen, typed };
}

function renderVocabularyChoices(ex) {
  const wordDisplay = document.getElementById('vocabularyWordDisplay');
  const soundBtn = document.getElementById('vocabularySoundBtn');
  const choicesContainer = document.getElementById('vocabularyChoices');
  const typedInput = document.getElementById('vocabularyTypedInput');
  // Listen mode (level 3) swaps the text display for the sound button
  // instead -- never more than one of {word text, sound button} visible at
  // once, same "one prompt widget visible" idea as letters' listen vs.
  // reverse mode split. Typed mode (level 4) still shows the word as text
  // (Hebrew, same as reverse mode) but swaps the multiple-choice row for the
  // typed-answer input.
  wordDisplay.style.display = ex.listen ? 'none' : '';
  soundBtn.style.display = ex.listen ? '' : 'none';
  soundBtn.disabled = false;
  choicesContainer.style.display = ex.typed ? 'none' : '';
  typedInput.style.display = ex.typed ? '' : 'none';
  if (ex.listen) {
    currentVocabularySpokenWord = ex.word;
  } else {
    wordDisplay.textContent = ex.word;
    // The prompt word is normally English (LTR) inside this RTL page --
    // .vocabulary-word-display hardcodes ltr for that. Reverse/typed modes'
    // prompt is Hebrew instead, so it needs the page's own rtl direction back.
    wordDisplay.classList.toggle('vocabulary-word-display-reverse', ex.reverse);
  }
  if (ex.typed) {
    typedInput.value = '';
    typedInput.disabled = false;
    // A previous round's "החלף שאלה" reveal (changeVocabularyTypedQuestion()
    // below) leaves this class on -- clear it so a fresh round doesn't start
    // pre-styled as a revealed answer.
    typedInput.classList.remove('answer-revealed');
    typedInput.focus();
    return;
  }
  choicesContainer.innerHTML = '';
  choicesContainer.classList.remove('vocabulary-choices-locked');
  ex.options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vocabulary-choice-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => checkVocabularyAnswer(option, ex.correct, btn));
    choicesContainer.appendChild(btn);
  });
  // Listen mode starts focus on the sound button, same "hear it, then pick"
  // entry point as letters' listen mode (renderLetterChoices(),
  // exercise-letters.js) -- otherwise (word already visible as text) the
  // first choice is the natural starting point, as before.
  if (ex.listen) {
    soundBtn.focus();
  } else if (choicesContainer.firstElementChild) {
    choicesContainer.firstElementChild.focus();
  }
}

// Wrong pick: that option is eliminated (stays disabled) and the same
// question continues with the remaining options -- same retry pattern as
// checkLetterAnswer() (exercise-letters.js). Kept as its own copy rather than
// sharing that function directly: unlike checkLetterAnswer(), there's no
// reverse-mode branch to dispatch on here (reverse/listen only ever change
// what generateVocabularyExercise() and renderVocabularyChoices() produce,
// never how an answer gets checked).
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
    // Otherwise the child could tap the sound button during this pause and
    // hear the old (already-answered) word, mistaking it for the next
    // question's -- same reasoning as letterSoundBtn's disable in
    // checkLetterAnswer() (exercise-letters.js). Harmless outside listen
    // mode: the button is hidden there anyway, and gets re-enabled by
    // renderVocabularyChoices() regardless of mode.
    document.getElementById('vocabularySoundBtn').disabled = true;
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

// Level 4's answer check, dispatched from checkAnswer() (exercise-core.js)
// via its isVocabularyTypedMode() branch -- same shared checkBtn/Enter-to-
// submit flow every numeric topic uses, unlike checkVocabularyAnswer() above
// (immediate per-click check, no separate confirm step). Case-insensitive
// and collapses whitespace (leading/trailing, and runs of spaces between
// words in a multi-word answer like "to wear" down to one) -- neither is
// the "spelling error" this level is testing for -- but otherwise an exact
// match: no partial credit, no fuzzy/near-miss leniency.
function normalizeVocabularyTypedAnswer(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function checkVocabularyTypedAnswer() {
  if (gameOver) return;

  const input = document.getElementById('vocabularyTypedInput');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (input.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const isCorrect = normalizeVocabularyTypedAnswer(input.value) === normalizeVocabularyTypedAnswer(currentVocabularyAnswer);

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
    // Same "leave it visible for a beat, disabled so it can't be typed over"
    // pause as the generic numeric checkAnswer() -- retries the same word
    // rather than eliminating anything (there's nothing discrete to
    // eliminate for free text).
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

// Level 4's "pay coins, see the answer, get a new question" escape hatch --
// dispatched from changeQuestion() (exercise-core.js) the same way
// checkVocabularyTypedAnswer() is dispatched from checkAnswer(), since this
// level's answer lives in #vocabularyTypedInput rather than the generic
// #answer/#answer2/#answer3 changeQuestion() otherwise operates on. Same
// cost/timing/counters as every other topic's swap (SWAP_QUESTION_COST,
// SWAP_REVEAL_MS, swapCount, swapTimeoutId -- all shared globals from
// exercise-core.js/config.js), just revealing into a different element.
function changeVocabularyTypedQuestion() {
  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const input = document.getElementById('vocabularyTypedInput');
  if (swapBtn.disabled) return; // already mid-reveal

  playerMoney -= SWAP_QUESTION_COST;
  swapCount++;
  updateCoinsDisplay();
  updateStatsCountersDisplay();
  showFloatingText(`-${SWAP_QUESTION_COST}`, 'negative', swapBtn);

  swapBtn.disabled = true;
  checkBtn.disabled = true;
  input.disabled = true;
  input.value = currentVocabularyAnswer;
  input.classList.add('answer-revealed');

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  swapTimeoutId = setTimeout(() => {
    checkBtn.disabled = false;
    input.disabled = false;
    swapBtn.disabled = false;
    newExercise(); // renderVocabularyChoices() clears .answer-revealed for the new round
  }, SWAP_REVEAL_MS);
}
