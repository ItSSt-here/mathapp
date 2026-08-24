// ---------- Vocabulary exercise ----------
// Level 1: an English word is shown and the student picks its Hebrew
// translation out of up to 5 options. Level 2 (isVocabularyReverseMode()):
// same mechanic, prompt/answer language flipped. Level 3
// (isVocabularyListenMode()): level 1's direction again, but the English
// word is spoken via TTS instead of shown as text. See
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
  const reverse = isVocabularyReverseMode();
  const listen = isVocabularyListenMode();
  const promptField = reverse ? 'he' : 'en';
  const answerField = reverse ? 'en' : 'he';
  const target = randChoice(vocabularyWordList);
  const distractorPool = vocabularyWordList.filter(w => w[answerField] !== target[answerField]);
  const distractorCount = Math.min(4, distractorPool.length);
  const distractors = pickDistinctRandom(distractorPool, distractorCount).map(w => w[answerField]);
  const options = pickDistinctRandom([target[answerField], ...distractors], distractorCount + 1); // shuffles the order too
  return { word: target[promptField], correct: target[answerField], options, reverse, listen };
}

function renderVocabularyChoices(ex) {
  const wordDisplay = document.getElementById('vocabularyWordDisplay');
  const soundBtn = document.getElementById('vocabularySoundBtn');
  // Listen mode (level 3) swaps the text display for the sound button
  // instead -- never both at once, same "one prompt widget visible" idea as
  // letters' listen vs. reverse mode split.
  wordDisplay.style.display = ex.listen ? 'none' : '';
  soundBtn.style.display = ex.listen ? '' : 'none';
  soundBtn.disabled = false;
  if (ex.listen) {
    currentVocabularySpokenWord = ex.word;
  } else {
    wordDisplay.textContent = ex.word;
    // The prompt word is normally English (LTR) inside this RTL page --
    // .vocabulary-word-display hardcodes ltr for that. Reverse mode's prompt
    // is Hebrew instead, so it needs the page's own rtl direction back.
    wordDisplay.classList.toggle('vocabulary-word-display-reverse', ex.reverse);
  }
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
  // Listen mode starts focus on the sound button, same "hear it, then pick"
  // entry point as letters' listen mode (renderLetterChoices(),
  // exercise-letters.js) -- otherwise (word already visible as text) the
  // first choice is the natural starting point, as before.
  if (ex.listen) {
    soundBtn.focus();
  } else if (container.firstElementChild) {
    container.firstElementChild.focus();
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
