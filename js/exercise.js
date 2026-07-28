// ---------- Exercise (question / answer / coins) ----------

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

// ---------- Letters exercise (recognition, multiple choice) ----------
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

// ---------- Nikud exercise (letter+קמץ recognition, multiple choice) ----------
// Returns the letters that must never appear alongside `letter` as a
// {correct, distractor} pair, per NIKUD_CONFUSABLE_PAIRS (see config.js for
// why each pair sounds identical once pointed).
function nikudConfusablesOf(letter) {
  return NIKUD_CONFUSABLE_PAIRS
    .filter(pair => pair.includes(letter))
    .map(pair => pair[0] === letter ? pair[1] : pair[0]);
}

function generateNikudExercise() {
  const correct = randChoice(HEBREW_LETTERS);
  const excluded = new Set([correct, ...nikudConfusablesOf(correct)]);
  const pool = HEBREW_LETTERS.filter(l => !excluded.has(l));
  const distractors = pickDistinctRandom(pool, 4);
  const options = pickDistinctRandom([correct, ...distractors], 5); // shuffles the order too
  return { correct, options };
}

// Recorded pronunciation clips (assets/nikud/kamats/<letter>.<ext>, see
// assets/nikud/CREDITS.txt for sources). Only קמץ exists so far -- niqud is
// hardcoded here rather than parameterized until a second niqud type is
// actually added. Most are soundsofnikud.com's site-sourced .mp3s; a few
// letters have since been replaced with a self-made .wav (a syllable trimmed
// out of a real, licensed word recording, see assets/nikud/CREDITS.txt) where
// the site's own clip was unusable -- NIKUD_CLIP_EXT records which.
//
// כ has no recording of its own that unambiguously means "כ with a dagesh" --
// the source site's כ clip is undageshed and sounds like ח. Since ק sounds
// identical to a dageshed כ, its clip is reused for כ instead (kaf_kamats.mp3
// is fetched but intentionally never played) -- the child still hears a
// correct, real "ka" sound, and still sees/picks כ, they just aren't hearing
// a recording of that exact glyph.
const NIKUD_AUDIO_OVERRIDE = { 'כ': 'ק' };

// פ: the site's own clip was unrecognizable as פ (reported as sounding like
// ה) -- replaced with a hard "pa" trimmed from a real-word recording of פס
// (see assets/nikud/CREDITS.txt). ט: the site's own clip was also reported
// as bad -- replaced with a clip trimmed from טל. Soft/undageshed ב and כ
// have also been self-recorded this way but aren't wired in yet -- level 1
// stays hard-only for now, soft versions are earmarked for a future level.
// כ's own site clip is still in use *indirectly* via NIKUD_AUDIO_OVERRIDE
// above (borrowing ק's) -- a candidate replacement word (כף) was found and
// fetched but the recording wasn't clear enough either; postponed.
const NIKUD_CLIP_EXT = { 'פ': 'wav', 'ט': 'wav' };
let currentNikudAudio = null;

function playNikudSound(letter) {
  if (!letter) return;
  if (currentNikudAudio) currentNikudAudio.pause(); // cut off a rapid repeat tap
  const audioLetter = NIKUD_AUDIO_OVERRIDE[letter] || letter;
  const ext = NIKUD_CLIP_EXT[audioLetter] || 'mp3';
  currentNikudAudio = new Audio(`assets/nikud/kamats/${encodeURIComponent(audioLetter)}.${ext}`);
  currentNikudAudio.play();
}

// Same #letterChoices container as renderLetterChoices(), but the letter and
// its קמץ mark are separate stacked elements (see .nikud-choice-btn in
// style.css) instead of one combined text node -- lets the mark be sized/
// colored independently so it reads clearly on its own, and stacking rows
// extends naturally if more niqud marks get added later. ב/כ/פ additionally
// get a (normally-combined, font-sized) דגש on the letter itself -- see
// NIKUD_DAGESH_LETTERS in config.js. The underlying option/correct values
// stay plain base letters, so checkLetterAnswer()'s comparison needs no
// changes.
function renderNikudChoices(ex) {
  const container = document.getElementById('letterChoices');
  container.innerHTML = '';
  container.classList.remove('letter-choices-locked');
  document.getElementById('letterSoundBtn').disabled = false;
  ex.options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'letter-choice-btn nikud-choice-btn';
    if (NIKUD_DESCENDER_LETTERS.includes(option)) btn.classList.add('nikud-descender-letter');
    const dagesh = NIKUD_DAGESH_LETTERS.includes(option) ? NIKUD_DAGESH_MARK : '';
    const letterSpan = document.createElement('span');
    letterSpan.className = 'nikud-letter';
    letterSpan.textContent = option + dagesh;
    const markSpan = document.createElement('span');
    // nikud-mark-kamats selects the CSS-drawn shape (see style.css) -- a
    // real standalone קמץ character renders as thin, faint line-strokes in
    // most fonts, which stayed hard to see even scaled way up, so the mark
    // is drawn as a plain bold shape instead of trusting the glyph. Keep
    // the real character as text content (not aria-hidden) for screen
    // readers; the shape is layered on top via ::before/::after.
    markSpan.className = 'nikud-mark nikud-mark-kamats';
    markSpan.textContent = NIKUD_KAMATS_MARK;
    btn.append(letterSpan, markSpan);
    btn.addEventListener('click', () => checkLetterAnswer(option, ex.correct, btn));
    container.appendChild(btn);
  });
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

// ---------- ABC exercise (English letters, recognition, multiple choice) ----------
// Levels 1-3 reuse the listen-then-pick mechanic (renderLetterChoices()/
// checkLetterAnswer() below are topic-agnostic), varying only the
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

function generateAbcExercise() {
  const level = exerciseDifficultyIndex + 1;
  const correct = randChoice(ABC_LETTERS);
  const distractors = pickDistinctRandom(ABC_LETTERS.filter(l => l !== correct), 4);
  const identities = pickDistinctRandom([correct, ...distractors], 5); // shuffles the order too

  if (level >= 4) {
    // Reverse mode: options are sound-button identities (always canonical
    // uppercase -- they're never displayed, only spoken), while the single
    // shown target letter gets its own independently-randomized case.
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
// entirely, same rationale as playLetterSound() above.
let currentAbcAudio = null;

function playAbcSound(letter) {
  if (!letter) return;
  if (currentAbcAudio) currentAbcAudio.pause(); // cut off a rapid repeat tap
  currentAbcAudio = new Audio(`assets/abc/${letter.toLowerCase()}.ogg`);
  currentAbcAudio.play();
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
    feedback.textContent = 'נכון';
    feedback.className = 'feedback correct';
    playerMoney += CORRECT_REWARD;
    updateCoinsDisplay();
    showFloatingText(`+${CORRECT_REWARD}`, 'positive', btnEl);
    // Otherwise the child can still tap the sound button during this pause
    // and hear the old (already-answered) letter, mistaking it for the next
    // question's -- re-enabled by renderLetterChoices() once the new
    // question is up.
    document.getElementById('letterSoundBtn').disabled = true;
    setTimeout(newExercise, 800);
  } else {
    btnEl.classList.add('letter-wrong');
    feedback.textContent = 'לא נכון, נסה שוב';
    feedback.className = 'feedback incorrect';
    playerMoney -= WRONG_PENALTY;
    updateCoinsDisplay();
    showFloatingText(`-${WRONG_PENALTY}`, 'negative', btnEl);
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
    feedback.textContent = 'נכון';
    feedback.className = 'feedback correct';
    playerMoney += CORRECT_REWARD;
    updateCoinsDisplay();
    showFloatingText(`+${CORRECT_REWARD}`, 'positive', btnEl);
    setTimeout(newExercise, 800);
  } else {
    btnEl.classList.add('letter-wrong');
    feedback.textContent = 'לא נכון, נסה שוב';
    feedback.className = 'feedback incorrect';
    playerMoney -= WRONG_PENALTY;
    updateCoinsDisplay();
    showFloatingText(`-${WRONG_PENALTY}`, 'negative', btnEl);
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

// ---------- Compare-fractions exercise (which fraction is bigger?) ----------
// Level 1 (currently every level, see EXERCISE_LEVEL_DESCRIPTIONS.comparefractions
// in config.js): randomly picks one of two sub-cases so the student can't
// coast on one memorized rule --
//   same denominator: p/n vs q/n (p != q) -- bigger numerator wins.
//   same numerator:   n/p vs n/q (p != q) -- SMALLER denominator wins (fewer,
//     bigger slices), the easy one to get backwards if you don't reason it out.
// Both fractions are always proper (numerator < denominator). Answer is
// always '<' or '>' -- COMPARE_OPTIONS in config.js already leaves room to
// add '=' later via a same-value sub-case.
function generateCompareFractionsExercise() {
  const sameDenominator = Math.random() < 0.5;
  let leftNum, leftDen, rightNum, rightDen, correct;

  if (sameDenominator) {
    const den = randInt(COMPARE_FRAC_SAME_DEN_MIN, COMPARE_FRAC_SAME_DEN_MAX);
    [leftNum, rightNum] = pickDistinctRandom(rangeArray(1, den - 1), 2);
    leftDen = rightDen = den;
    correct = leftNum > rightNum ? '>' : '<';
  } else {
    const num = randInt(COMPARE_FRAC_SAME_NUM_MIN, COMPARE_FRAC_SAME_NUM_MAX);
    [leftDen, rightDen] = pickDistinctRandom(rangeArray(num + 1, num + COMPARE_FRAC_DEN_SPREAD), 2);
    leftNum = rightNum = num;
    correct = leftDen < rightDen ? '>' : '<';
  }

  return { leftNum, leftDen, rightNum, rightDen, correct };
}

// Renders the '<'/'>' pick buttons into #compareChoices, in its own row
// below the question (#compareAnswerHome in index.html) rather than inline
// with the fractions -- reuses .letter-choice-btn so the correct/wrong/
// disabled states match every other multiple-choice topic without
// duplicating that CSS.
function renderCompareChoices() {
  const container = document.getElementById('compareChoices');
  container.innerHTML = '';
  container.classList.remove('compare-choices-locked');
  COMPARE_OPTIONS.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'letter-choice-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => checkCompareAnswer(option, btn));
    container.appendChild(btn);
  });
}

// Only two options exist, so unlike checkLetterAnswer()'s eliminate-and-retry
// pattern, a wrong pick here can't just disable that one button -- the other
// would then be a free correct answer. Instead a wrong pick reveals the
// correct answer in #compareBlank (red, same convention as
// input.answer-revealed:disabled for the swap-question button) and moves on
// to a new question after SWAP_REVEAL_MS, same pause changeQuestion() uses.
function checkCompareAnswer(selected, btnEl) {
  if (gameOver) return;

  const container = document.getElementById('compareChoices');
  if (container.classList.contains('compare-choices-locked')) return;

  const feedback = document.getElementById('feedback');
  const blank = document.getElementById('compareBlank');
  const isCorrect = selected === currentCompareAnswer;

  container.classList.add('compare-choices-locked');
  Array.from(container.children).forEach(b => b.disabled = true);

  if (isCorrect) {
    blank.textContent = selected;
    blank.classList.add('answer-correct');
    btnEl.classList.add('letter-correct');
    feedback.textContent = 'נכון';
    feedback.className = 'feedback correct';
    playerMoney += CORRECT_REWARD;
    updateCoinsDisplay();
    showFloatingText(`+${CORRECT_REWARD}`, 'positive', btnEl);
    setTimeout(newExercise, 800);
  } else {
    btnEl.classList.add('letter-wrong');
    blank.textContent = currentCompareAnswer;
    blank.classList.add('revealed');
    feedback.textContent = 'לא נכון';
    feedback.className = 'feedback incorrect';
    playerMoney -= WRONG_PENALTY;
    updateCoinsDisplay();
    showFloatingText(`-${WRONG_PENALTY}`, 'negative', btnEl);
    setTimeout(newExercise, SWAP_REVEAL_MS);
  }
}

function fractionBlockHTML(numerator, denominator) {
  return `<span class="frac-block"><span class="frac-num">${numerator}</span><span class="frac-bar"></span><span class="frac-den">${denominator}</span></span>`;
}

// Same shape as fractionBlockHTML but leaves out whichever component(s) are
// missing -- newExercise() inserts the live #answer/#answer2 inputs there.
function fractionAnswerBlockHTML(missing, targetNumerator, targetDenominator) {
  const numPart = (missing === 'numerator' || missing === 'both') ? '' : `<span class="frac-num">${targetNumerator}</span>`;
  const denPart = (missing === 'denominator' || missing === 'both') ? '' : `<span class="frac-den">${targetDenominator}</span>`;
  return `<span class="frac-block frac-answer-block" id="fracAnswerSlot">${numPart}<span class="frac-bar"></span>${denPart}</span>`;
}

function newExercise() {
  const questionText = document.getElementById('questionText');
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const answer2Home = document.getElementById('answer2Home');
  const simplifyLabel = document.getElementById('simplifyLabel');
  simplifyLabel.style.display = 'none';

  // Letters/ABC modes have no equation/typed answer at all -- swap the whole
  // question+answer UI for the sound button + multiple-choice buttons
  // instead of reusing the numeric-input elements. Listen-mode levels
  // (letters 1, abc 1-3) keep checkBtn hidden (picking a letter button
  // answers immediately); reverse-mode levels (letters 2-5, abc 4-5) need
  // it, since picking a sound only selects it -- checkAnswer() dispatches to
  // checkLetterReverseAnswer() for those via isLetterReverseMode().
  const isLetters = gameMode === 'letters';
  const isAbc = gameMode === 'abc';
  const isNikud = gameMode === 'nikud';
  const isCompare = gameMode === 'comparefractions';
  const isLetterFamily = isLetters || isAbc || isNikud;
  const isReverse = isLetterReverseMode(); // always false for nikud -- no reverse direction yet
  document.getElementById('mathQuestionRow').style.display = isLetterFamily ? 'none' : '';
  document.getElementById('answerHome').style.display = (isLetterFamily || isCompare) ? 'none' : '';
  document.getElementById('checkBtn').style.display = ((isLetterFamily && !isReverse) || isCompare) ? 'none' : '';
  document.getElementById('swapBtn').style.display = (isLetterFamily || isCompare) ? 'none' : '';
  document.getElementById('lettersAnswerHome').style.display = isLetterFamily ? '' : 'none';
  document.getElementById('compareAnswerHome').style.display = isCompare ? '' : 'none';

  if (isCompare) {
    const ex = generateCompareFractionsExercise();
    currentCompareAnswer = ex.correct;
    questionText.innerHTML =
      '<span class="frac-eq compare-eq">' +
        fractionBlockHTML(ex.leftNum, ex.leftDen) +
        '<span class="compare-blank" id="compareBlank"></span>' +
        fractionBlockHTML(ex.rightNum, ex.rightDen) +
      '</span>';
    renderCompareChoices();
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    return;
  }

  if (isLetterFamily) {
    document.getElementById('letterListenMode').style.display = isReverse ? 'none' : '';
    document.getElementById('letterRevealMode').style.display = isReverse ? '' : 'none';
    const ex = isAbc ? generateAbcExercise() : (isNikud ? generateNikudExercise() : generateLetterExercise());
    currentLetterAnswer = ex.correct;
    if (isReverse) {
      renderLetterReverseChoices(ex);
    } else if (isNikud) {
      renderNikudChoices(ex);
    } else {
      renderLetterChoices(ex);
    }
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    return;
  }

  if (gameMode === 'fractions') {
    const ex = generateFractionExercise();
    currentAnswer = ex.answer;
    if (ex.missing === 'both') simplifyLabel.style.display = '';
    questionText.innerHTML =
      '<span class="frac-eq">' +
        fractionBlockHTML(ex.shownNumerator, ex.shownDenominator) +
        '<span class="frac-op">=</span>' +
        fractionAnswerBlockHTML(ex.missing, ex.targetNumerator, ex.targetDenominator) +
      '</span>';
    answerInput.classList.add('fraction-answer-input');
    const slot = document.getElementById('fracAnswerSlot');

    if (ex.missing === 'both') {
      slot.insertBefore(answerInput, slot.querySelector('.frac-bar'));
      answer2.classList.add('fraction-answer-input');
      slot.appendChild(answer2);
    } else {
      if (ex.missing === 'numerator') {
        slot.prepend(answerInput);
      } else {
        slot.appendChild(answerInput);
      }
      answer2.classList.remove('fraction-answer-input');
      answer2Home.appendChild(answer2);
    }
  } else {
    [num1, num2] = pickNumbers();
    currentAnswer = num1 * num2;
    questionText.innerHTML = `<span class="mult-eq">${num1} × ${num2}<span class="mult-op">=</span><span id="multAnswerSlot"></span></span>`;
    answerInput.classList.remove('fraction-answer-input');
    document.getElementById('multAnswerSlot').appendChild(answerInput);
    answer2.classList.remove('fraction-answer-input');
    answer2Home.appendChild(answer2);
  }

  answerInput.value = '';
  answer2.value = '';
  answerInput.classList.remove('answer-revealed');
  answer2.classList.remove('answer-revealed');
  answerInput.focus();
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';
}

// Spawns a one-off floating "+10"/"-5" style popup anchored to an element
// (the answer input or the swap button), which rises and fades on its own
// CSS animation, then removes itself.
function showFloatingText(text, colorClass, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `floating-text ${colorClass}`;
  el.textContent = text;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top}px`;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function checkAnswer() {
  if (gameOver) return;

  if (isLetterReverseMode()) {
    checkLetterReverseAnswer();
    return;
  }

  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');

  if (checkBtn.disabled) return;

  // A full-reduction fraction exercise (level 4+) has two blanks; every
  // other exercise (multiplication or a single-blank fraction) has one.
  const isTwoBlank = typeof currentAnswer === 'object';

  if (answerInput.value.trim() === '' || (isTwoBlank && answer2.value.trim() === '')) {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const userAnswer = parseInt(answerInput.value, 10);
  const isCorrect = isTwoBlank
    ? userAnswer === currentAnswer.numerator && parseInt(answer2.value, 10) === currentAnswer.denominator
    : userAnswer === currentAnswer;

  if (isCorrect) {
    feedback.textContent = 'נכון';
    feedback.className = 'feedback correct';
    playerMoney += CORRECT_REWARD;
    updateCoinsDisplay();
    showFloatingText(`+${CORRECT_REWARD}`, 'positive', answerInput);

    // Disable until the next exercise is fully in place, so repeated
    // clicks/Enter presses during the reward pause can't re-award coins
    // or queue up multiple newExercise() calls.
    checkBtn.disabled = true;
    answerInput.disabled = true;
    answer2.disabled = true;
    setTimeout(() => {
      checkBtn.disabled = false;
      answerInput.disabled = false;
      answer2.disabled = false;
      newExercise();
    }, 800);
  } else {
    feedback.textContent = 'לא נכון, נסה שוב';
    feedback.className = 'feedback incorrect';
    playerMoney -= WRONG_PENALTY;
    updateCoinsDisplay();
    showFloatingText(`-${WRONG_PENALTY}`, 'negative', answerInput);

    // Leave the wrong answer visible for a beat so the player can see what
    // they typed, instead of wiping it instantly -- the inputs are disabled
    // meanwhile so they can't type over it and re-trigger the append bug.
    answerInput.disabled = true;
    answer2.disabled = true;
    checkBtn.disabled = true;
    setTimeout(() => {
      answerInput.value = '';
      answer2.value = '';
      answerInput.disabled = false;
      answer2.disabled = false;
      checkBtn.disabled = false;
      answerInput.focus();
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}

// Reveals the correct answer for a couple of seconds, then swaps in a new
// question. Always costs coins, even if that pushes the balance negative.
function changeQuestion() {
  if (gameOver) return;

  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  if (swapBtn.disabled) return; // already mid-reveal

  playerMoney -= SWAP_QUESTION_COST;
  updateCoinsDisplay();
  showFloatingText(`-${SWAP_QUESTION_COST}`, 'negative', swapBtn);

  swapBtn.disabled = true;
  checkBtn.disabled = true;
  answerInput.disabled = true;
  answer2.disabled = true;

  // Fill the blank(s) themselves in red, in place -- both exercise types
  // show the answer inside the equation now, so this is the same for either.
  const isTwoBlank = typeof currentAnswer === 'object';
  answerInput.value = isTwoBlank ? currentAnswer.numerator : currentAnswer;
  answerInput.classList.add('answer-revealed');
  if (isTwoBlank) {
    answer2.value = currentAnswer.denominator;
    answer2.classList.add('answer-revealed');
  }

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  swapTimeoutId = setTimeout(() => {
    checkBtn.disabled = false;
    answerInput.disabled = false;
    answer2.disabled = false;
    swapBtn.disabled = false;
    newExercise();
  }, SWAP_REVEAL_MS);
}

function updateCoinsDisplay() {
  const coinsEl = document.getElementById('coins');
  // The number is wrapped in its own LTR span so a negative balance
  // doesn't get its minus sign flipped by the page's RTL bidi handling.
  coinsEl.innerHTML = `מטבעות: <span style="direction:ltr;unicode-bidi:isolate">${playerMoney}</span>`;
  coinsEl.className = playerMoney < 0 ? 'coins negative' : 'coins';
  document.getElementById('buyBtn').disabled = playerMoney < SOLDIER_COST || gameOver;
}
