// ---------- ABC exercise (English letters, recognition, multiple choice) ----------
// Levels 1-3 reuse the listen-then-pick mechanic (renderLetterChoices()/
// checkLetterAnswer() in exercise-letters.js are topic-agnostic), varying only the
// upper/lowercase of the 5 shown letters: level 1 always uppercase, level 2
// always lowercase, level 3 randomizes each shown letter independently.
// Levels 4-5 flip to the reverse direction (renderLetterReverseChoices()),
// showing one letter (case randomized) and having the child match it to a
// sound.
function abcCaseForLevel(letter, level) {
  if (level === 1) return letter;
  if (level === 2) return letter.toLowerCase();
  return Math.random() < 0.5 ? letter : letter.toLowerCase(); // level 3: 50/50 per letter
}

// Returns the letters that must never appear as a distractor sound alongside
// `letter` when it's the one actually shown, per ABC_VISUAL_CONFUSABLE_PAIRS
// in config.js (currently just I/L) -- reverse mode only, see
// generateAbcExercise(). See confusablesOf() in helpers.js.
function abcVisualConfusablesOf(letter) {
  return confusablesOf(letter, ABC_VISUAL_CONFUSABLE_PAIRS);
}

// Returns the letters that must never appear as a distractor letter alongside
// `letter` when it's the one actually played, per ABC_AUDIO_CONFUSABLE_PAIRS
// in config.js (currently just M/N) -- listen mode only, see
// generateAbcExercise().
function abcAudioConfusablesOf(letter) {
  return confusablesOf(letter, ABC_AUDIO_CONFUSABLE_PAIRS);
}

function generateAbcExercise() {
  const level = exerciseDifficultyIndex + 1;
  const correct = randChoice(ABC_LETTERS);
  const isReverse = level >= 4;

  // Reverse mode shows only one letter's shape at a time, with nothing to
  // compare it against -- even with Verdana keeping I and l visually
  // distinct *side by side* (see .abc-mode in style.css), a lone "l" still
  // can't be told apart from "I" with confidence. Listen mode shows all 5
  // shapes at once, where that side-by-side distinction already works, so
  // the I/L exclusion is reverse-mode only.
  //
  // M/N is the opposite: listen mode plays one sound in isolation and asks
  // the child to pick the matching shape, which is an unfair guess between
  // two similar-sounding letters -- excluded there. Reverse mode shows the
  // shape and lets the child tap through every candidate sound to compare,
  // so M/N stay eligible distractors there.
  const excluded = isReverse
    ? new Set([correct, ...abcVisualConfusablesOf(correct)])
    : new Set([correct, ...abcAudioConfusablesOf(correct)]);
  const distractors = pickDistinctRandom(ABC_LETTERS.filter(l => !excluded.has(l)), 4);
  const identities = pickDistinctRandom([correct, ...distractors], 5); // shuffles the order too

  if (isReverse) {
    // Options are sound-button identities (always canonical uppercase --
    // they're never displayed, only spoken), while the single shown target
    // letter gets its own independently-randomized case.
    return { correct, options: identities, displayCorrect: Math.random() < 0.5 ? correct : correct.toLowerCase() };
  }

  // Listen mode: each shown letter (including the correct one) is cased per
  // abcCaseForLevel(), and `correct` is set to that same cased string so it
  // matches the exact button text checkLetterAnswer() compares against.
  const options = identities.map(letter => abcCaseForLevel(letter, level));
  return { correct: options[identities.indexOf(correct)], options };
}

// Recorded pronunciation clips (assets/abc/<letter>.ogg, lowercase filename
// regardless of the letter's displayed case -- see assets/abc/CREDITS.txt for
// sources/licenses). speechSynthesis was tried first, but came out too
// unclear for a child to reliably understand even after tuning voice/rate
// and adding pronunciation overrides -- real recordings sidestep that
// entirely, same rationale as playLetterSound() in exercise-letters.js.
let currentAbcAudio = null;

function playAbcSound(letter) {
  if (!letter) return;
  if (currentAbcAudio) currentAbcAudio.pause(); // cut off a rapid repeat tap
  currentAbcAudio = new Audio(`assets/abc/${letter.toLowerCase()}.ogg`);
  currentAbcAudio.play();
}
