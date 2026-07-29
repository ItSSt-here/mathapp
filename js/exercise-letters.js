// ---------- Letters exercise (Hebrew recognition) + the shared letter-family engine ----------
// generateLetterExercise() below is the Hebrew-letters-specific generator.
// Everything else in this file -- isLetterReverseMode(), playCurrentTopicSound(),
// renderLetterChoices(), checkLetterAnswer(), and the reverse-mode functions --
// is shared infrastructure that abc (exercise-abc.js) and nikud
// (exercise-nikud.js) also call into directly. Hebrew letters was the first
// of the three "letter family" topics built, so its plumbing became the
// shared one; it stays topic-agnostic (works off whatever options/correct
// values the caller's generate*Exercise() produced) rather than being moved
// again later.

function generateLetterExercise() {
  const correct = randChoice(HEBREW_LETTERS);
  const distractors = pickDistinctRandom(HEBREW_LETTERS.filter(l => l !== correct), 4);
  const options = pickDistinctRandom([correct, ...distractors], 5); // shuffles the order too
  return { correct, options };
}

// Letters: level 1 hears the letter and picks it visually; levels 2-5 flip
// that -- the letter is shown and the child picks which of 5 sound buttons
// names it. ABC: levels 1-3 are the listen-then-pick direction (upper/lower
// case varies by level, see generateAbcExercise()); levels 4-5 flip it the
// same way letters' levels 2-5 do. Nikud has no reverse direction yet -- every
// level uses the listen-then-pick mechanic (see generateNikudExercise()).
function isLetterReverseMode() {
  if (gameMode === 'letters') return exerciseDifficultyIndex >= 1;
  if (gameMode === 'abc') return exerciseDifficultyIndex >= 3;
  return false;
}

// Recorded pronunciation clips (assets/letters/<letter>.mp3, see
// assets/letters/CREDITS.txt for sources/licenses) -- browser speechSynthesis
// was tried first, but generic TTS reads several letter names as unrelated
// homograph words (e.g. אלף as "thousand") since Hebrew is normally written
// without the vowel points that would disambiguate them, and voice
// availability varies wildly across machines. Recorded audio sidesteps both.
let currentLetterAudio = null;

// A plain <audio> element's .volume tops out at 1.0 (the recording's own
// mastered level), which isn't enough for clips that were recorded quietly
// -- ק in particular. Boosted letters are routed through a Web Audio gain
// node instead, which can amplify past that ceiling; everything else plays
// through the element directly, untouched.
let letterAudioCtx = null;
const LETTER_VOLUME_BOOST = { 'ק': 2.2 };

function playLetterSound(letter) {
  if (!letter) return;
  if (currentLetterAudio) currentLetterAudio.pause(); // cut off a rapid repeat tap
  currentLetterAudio = new Audio(`assets/letters/${encodeURIComponent(letter)}.mp3`);

  const boost = LETTER_VOLUME_BOOST[letter];
  if (boost && window.AudioContext) {
    if (!letterAudioCtx) letterAudioCtx = new AudioContext();
    letterAudioCtx.resume();
    const source = letterAudioCtx.createMediaElementSource(currentLetterAudio);
    const gainNode = letterAudioCtx.createGain();
    gainNode.gain.value = boost;
    source.connect(gainNode).connect(letterAudioCtx.destination);
  }

  currentLetterAudio.play();
}

// Dispatches to the right sound source for whichever letters-family topic is
// currently active (see letterSoundBtn's click handler in main.js).
function playCurrentTopicSound(letter) {
  if (gameMode === 'abc') {
    playAbcSound(letter);
  } else if (gameMode === 'nikud') {
    playNikudSound(letter);
  } else {
    playLetterSound(letter);
  }
}

function renderLetterChoices(ex) {
  const container = document.getElementById('letterChoices');
  container.innerHTML = '';
  container.classList.remove('letter-choices-locked');
  document.getElementById('letterSoundBtn').disabled = false;
  ex.options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'letter-choice-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => checkLetterAnswer(option, ex.correct, btn));
    container.appendChild(btn);
  });
}

// Wrong pick: that option is eliminated (stays disabled) and the same
// question continues with the remaining options, same as the numeric modes
// letting you retry after a mistake instead of jumping to a new question.
function checkLetterAnswer(selected, correct, btnEl) {
  if (gameOver) return;

  const container = document.getElementById('letterChoices');
  if (container.classList.contains('letter-choices-locked')) return;

  const feedback = document.getElementById('feedback');
  const isCorrect = selected === correct;

  container.classList.add('letter-choices-locked');
  Array.from(container.children).forEach(b => b.disabled = true);

  if (isCorrect) {
    btnEl.classList.add('letter-correct');
    markCorrect(btnEl);
    // Otherwise the child can still tap the sound button during this pause
    // and hear the old (already-answered) letter, mistaking it for the next
    // question's -- re-enabled by renderLetterChoices() once the new
    // question is up.
    document.getElementById('letterSoundBtn').disabled = true;
    setTimeout(newExercise, 800);
  } else {
    btnEl.classList.add('letter-wrong');
    markWrong(btnEl);
    setTimeout(() => {
      Array.from(container.children).forEach(b => { if (b !== btnEl) b.disabled = false; });
      container.classList.remove('letter-choices-locked');
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}

// Levels 2-5 (reverse direction): the target letter is shown visually and
// the child taps sound buttons (each plays a candidate letter's name) until
// they've picked the one they believe matches, then confirms with the
// checkBtn -- see checkAnswer()'s isLetterReverseMode() branch.
let letterReverseSelected = null; // { option, btnEl } for the currently-selected sound button, or null

function renderLetterReverseChoices(ex) {
  document.getElementById('letterRevealDisplay').textContent = ex.displayCorrect || ex.correct;
  const container = document.getElementById('letterSoundChoices');
  container.innerHTML = '';
  container.classList.remove('letter-choices-locked');
  letterReverseSelected = null;
  document.getElementById('checkBtn').disabled = true;
  ex.options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'letter-choice-btn';
    btn.textContent = '🔊';
    btn.addEventListener('click', () => selectLetterReverseOption(option, btn));
    container.appendChild(btn);
  });
}

// Tapping a sound button plays it and selects it as the current answer --
// re-tapping the same or a different button just moves the selection and
// replays that sound, since nothing is locked in until checkBtn is pressed.
function selectLetterReverseOption(option, btnEl) {
  if (gameOver) return;
  const container = document.getElementById('letterSoundChoices');
  if (container.classList.contains('letter-choices-locked')) return;

  playCurrentTopicSound(option);
  Array.from(container.children).forEach(b => b.classList.remove('letter-selected'));
  btnEl.classList.add('letter-selected');
  letterReverseSelected = { option, btnEl };
  document.getElementById('checkBtn').disabled = false;
}

// Wrong: that sound button is eliminated (disabled) and the same question
// continues with the remaining options, same retry pattern as
// checkLetterAnswer() uses for the level 1 (listen-then-pick) direction.
function checkLetterReverseAnswer() {
  if (gameOver || !letterReverseSelected) return;

  const container = document.getElementById('letterSoundChoices');
  if (container.classList.contains('letter-choices-locked')) return;

  const { option, btnEl } = letterReverseSelected;
  const feedback = document.getElementById('feedback');
  const checkBtn = document.getElementById('checkBtn');
  const isCorrect = option === currentLetterAnswer;

  container.classList.add('letter-choices-locked');
  Array.from(container.children).forEach(b => b.disabled = true);
  checkBtn.disabled = true;
  btnEl.classList.remove('letter-selected');

  if (isCorrect) {
    btnEl.classList.add('letter-correct');
    markCorrect(btnEl);
    setTimeout(newExercise, 800);
  } else {
    btnEl.classList.add('letter-wrong');
    markWrong(btnEl);
    setTimeout(() => {
      letterReverseSelected = null;
      Array.from(container.children).forEach(b => { if (b !== btnEl) b.disabled = false; });
      container.classList.remove('letter-choices-locked');
      feedback.textContent = '';
      feedback.className = 'feedback';
      // checkBtn stays disabled until the child selects another option
    }, 800);
  }
}
