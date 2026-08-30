// ---------- Exercise core: dispatcher, answer-checking, and shared UI helpers ----------
// newExercise()/checkAnswer() are the switchboard every topic runs through --
// they decide which topic-specific generate*Exercise()/render*Choices()
// function to call (defined in the other exercise-*.js files) and own the
// UI elements shared by all of them (coins, feedback text, the floating
// +10/-5 popup). See index.html for the <script> load order this depends on.

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

// Same idea as fractionAnswerBlockHTML, but for a mixed number w  r/b: the
// whole part gets a plain slot (newExercise() parks the plain #answer input
// there, no fraction-sized styling), the remainder numerator lives in a
// normal frac-block above the fixed, shown denominator b. Wrapped in a single
// .mixed-num-group span rather than left as two bare siblings -- .frac-eq can
// now wrap onto multiple lines on narrow screens (see its flex-wrap comment
// in style.css), and without this wrapper the line break could land *between*
// the whole box and its own fraction, splitting one mixed number across two
// lines (reported by the user 2026-08-12 right after that flex-wrap change
// shipped). Grouping them into one flex item makes the pair unsplittable.
function mixedNumberAnswerBlockHTML(targetDenominator) {
  return `<span class="mixed-num-group"><span id="mixedWholeSlot"></span><span class="frac-block" id="mixedFracSlot"><span class="frac-bar"></span><span class="frac-den">${targetDenominator}</span></span></span>`;
}

// Level 2's left-hand side: a *given* mixed number w  r/b, both parts fixed
// (not editable). Reuses .frac-num's own styling for the plain whole-number
// text so it reads at the same visual weight as the fraction's digits,
// without needing a dedicated CSS class. Same .mixed-num-group wrapping
// reasoning as mixedNumberAnswerBlockHTML() above.
function mixedNumberDisplayHTML(whole, remainderNumerator, denominator) {
  return `<span class="mixed-num-group"><span class="frac-num">${whole}</span>${fractionBlockHTML(remainderNumerator, denominator)}</span>`;
}

// Renders a "<shown> = <blank>" fraction equation and wires #answer/#answer2
// into the blank's slot(s) -- shared by the "fractions" (one given fraction),
// "addfractions" (two given fractions + "+"), and "subtractfractions" (two
// given fractions + "−") branches of newExercise() below, since all three
// are otherwise identical: `shownHTML` is just whatever goes on the left of
// the "=" (built by the caller from fractionBlockHTML()), and everything
// from there -- the "צמצם ככל הניתן" label, the blank fraction slot, which
// of #answer/#answer2 goes where -- doesn't depend on which topic produced
// `ex`. missing:'denominator' only ever comes from the "fractions" topic
// (addfractions/subtractfractions's single-blank case is always
// 'numerator', since their denominator is always given) but handling it
// generically here costs nothing and keeps this usable by all three.
function renderFractionAnswerEquation(shownHTML, ex, questionText, answerInput, answer2, answer2Home, simplifyLabel) {
  if (ex.missing === 'both') simplifyLabel.style.display = '';
  questionText.innerHTML =
    '<span class="frac-eq">' +
      shownHTML +
      '<span class="frac-op">=</span>' +
      fractionAnswerBlockHTML(ex.missing, ex.targetNumerator, ex.targetDenominator) +
    '</span>';
  answerInput.classList.add('fraction-answer-input');
  const slot = document.getElementById('fracAnswerSlot');

  if (ex.missing === 'both') {
    answerInput.setAttribute('enterkeyhint', 'next');
    slot.insertBefore(answerInput, slot.querySelector('.frac-bar'));
    answer2.classList.add('fraction-answer-input');
    slot.appendChild(answer2);
  } else {
    if (ex.missing === 'denominator') {
      slot.appendChild(answerInput);
    } else {
      slot.prepend(answerInput);
    }
    answer2.classList.remove('fraction-answer-input');
    answer2Home.appendChild(answer2);
  }
}

// True whenever the current exercise's whole-number box (#answer) sits
// beside a fraction (not stacked above it) and a blank there is a legitimate
// answer (asserts 0) rather than "not yet answered" -- shared across every
// topic using this exact answer shape: mixed numbers' own two such levels
// (isMixedNumberWholeBoxLevel(), exercise-mixednumbers.js) and every
// addfractionsadvanced level (isAddFractionsAdvancedLevel1()/2()/3()/4(),
// exercise-addfractionsadvanced.js). main.js's #answer/#answer2 keydown/blur
// handlers gate on this instead of either topic's own helper directly. Safe
// despite load order -- both of those files load before main.js, and this
// function's body isn't evaluated until called, same as newExercise() below
// already calling generateMixedNumberExercise() from a later-loaded file.
function isWholeBoxAnswerLevel() {
  return isMixedNumberWholeBoxLevel() || isAddFractionsAdvancedLevel1() || isAddFractionsAdvancedLevel2() ||
    isAddFractionsAdvancedLevel3() || isAddFractionsAdvancedLevel4();
}

// True whenever the current exercise's two blanks sit left-to-right on the
// same row rather than stacked (numerator over denominator in one
// .frac-block) -- every isWholeBoxAnswerLevel() case, plus the addfractions
// level 3 scaffold, whose two blanks are two different fraction slots on the
// same row (isFractionAdditionScaffoldLevel(), exercise-addfractions.js), not
// one fraction's own numerator+denominator. Kept separate from
// isWholeBoxAnswerLevel() itself, which also governs the legitimate-
// blank-asserts-0 styling -- that doesn't apply here, since both of this
// level's boxes are ordinary required digits. main.js's #answer/#answer2
// keydown handlers gate their ArrowLeft/ArrowRight (vs. ArrowUp/ArrowDown)
// choice on this.
function isHorizontalTwoBoxLevel() {
  return isWholeBoxAnswerLevel() || isFractionAdditionScaffoldLevel();
}

// True whenever the current exercise is the *two*-box variant of the above
// (#answer whole + #answer2 remainder numerator, fixed denominator) --
// mixed-numbers level 1 and addfractionsadvanced levels 1 and 3 (level 3's
// answer shape is identical to level 1's; only the *shown* addends differ).
// Named to mirror isThreeBoxAnswerLevel() below.
function isTwoBoxWholeAnswerLevel() {
  return isMixedNumberLevel1() || isAddFractionsAdvancedLevel1() || isAddFractionsAdvancedLevel3();
}

// True whenever the current exercise is the *three*-box variant of the above
// (#answer whole + #answer2/#answer3 reduced numerator/denominator) --
// mixed-numbers level 3 and addfractionsadvanced levels 2/4. #answer3's own
// keydown listener (wireMixedNumberLevel3Answer3Nav() in
// exercise-mixednumbers.js) is already fully generic and needs no widening;
// only the one guarded branch in #answer2's handler (main.js) and
// changeQuestion()'s reveal below need to know which shape they're looking at.
function isThreeBoxAnswerLevel() {
  return isMixedNumberLevel3() || isAddFractionsAdvancedLevel2() || isAddFractionsAdvancedLevel4();
}

// ---------- Weak pool: replay recently-missed exercises ----------
// Every topic's newExercise() branch below builds its question/answer purely
// from the object its own generate*Exercise() returns (the `ex` locals) --
// so replaying a past mistake is just a matter of handing that exact object
// back instead of generating a new one, with no per-topic logic needed here.
// See config.js for the WEAK_POOL_* constants and state.

// Called once per newExercise(), before any topic branch runs: just clears
// the "had a mistake yet" guard for the question about to be shown. Pool
// entries are aged in pickExercise() below, not here -- see its comment for
// why the order matters.
function tickWeakPool() {
  currentQuestionHadMistake = false;
}

// Call site for every topic's `const ex = generate...()` -- returns a pooled
// exercise WEAK_POOL_DRAW_CHANCE of the time (once one's countdown has
// reached 0), otherwise calls generateFn() for a fresh one. Either way,
// tracks which case just happened so markCorrect()/markWrong()/changeQuestion()
// know what to do with it once this question is resolved.
//
// Eligibility is checked against each entry's countdown *before* aging it
// for this round, and every entry is aged by 1 only afterward -- so an
// entry that reaches 0 this round isn't also eligible to be drawn this same
// round. That's what makes "countdown N" actually mean N full other
// questions pass before this one can resurface: aging-then-checking would
// let the very question that ticks an entry down to 0 also be the one that
// draws it, one question earlier than intended.
function pickExercise(generateFn) {
  activePoolEntry = null;
  currentExerciseSnapshot = null;
  let ex = null;
  if (weakPoolReviewEnabled) {
    const eligible = weakPool.filter(entry => entry.countdown <= 0);
    if (eligible.length > 0 && Math.random() < WEAK_POOL_DRAW_CHANCE) {
      activePoolEntry = eligible[Math.floor(Math.random() * eligible.length)];
      ex = activePoolEntry.ex;
    }
  }
  if (ex === null) {
    ex = generateFn();
    currentExerciseSnapshot = ex;
  }
  if (weakPoolReviewEnabled) {
    for (const entry of weakPool) {
      if (entry !== activePoolEntry && entry.countdown > 0) entry.countdown--;
    }
  }
  return ex;
}

// Shared by recordWeakPoolRecovery()/recordWeakPoolSwap() below -- adds the
// current (non-pooled) question at the given countdown, evicting the oldest
// entry first if already at WEAK_POOL_MAX_SIZE.
function pushToWeakPool(countdown) {
  if (!currentExerciseSnapshot) return; // this topic branch didn't route through pickExercise() (shouldn't happen, but don't crash if it does)
  weakPool.push({ ex: currentExerciseSnapshot, countdown });
  if (weakPool.length > WEAK_POOL_MAX_SIZE) weakPool.shift();
}

// Called from markWrong() -- just flags that this question instance has had
// at least one wrong attempt. The actual pool decision is deferred to
// however this question instance eventually resolves (see
// recordWeakPoolRecovery()/recordWeakPoolSwap() below): getting it wrong
// doesn't by itself mean anything goes into the pool yet, since the very
// next attempt might get it right.
function recordWeakPoolMistake() {
  currentQuestionHadMistake = true;
}

// Called from markCorrect(). A pooled question only graduates out of the
// pool if this replay got it right on the first try -- missing it again
// before recovering means it's still shaky, so it stays in the pool at the
// short WEAK_POOL_SWAP_COUNTDOWN (same reasoning as a swap: still doesn't
// reliably know it, retest soon) instead of leaving for good. A fresh
// question that needed at least one wrong attempt before being answered
// correctly enters the pool at WEAK_POOL_RECOVERED_COUNTDOWN -- a longer
// wait than that, since actually recovering the right answer on a first
// encounter (rather than giving up, or needing a second pass) is the
// strongest of the three signals. A question answered correctly on the
// first try was never in trouble, so it's left alone entirely.
function recordWeakPoolRecovery() {
  if (!weakPoolReviewEnabled) return;
  if (activePoolEntry) {
    if (currentQuestionHadMistake) {
      activePoolEntry.countdown = WEAK_POOL_SWAP_COUNTDOWN;
      return;
    }
    const idx = weakPool.indexOf(activePoolEntry);
    if (idx !== -1) weakPool.splice(idx, 1);
    return;
  }
  if (currentQuestionHadMistake) pushToWeakPool(WEAK_POOL_RECOVERED_COUNTDOWN);
}

// Called from changeQuestion()/changeVocabularyTypedQuestion() -- swapping a
// question away means it was never actually answered on this instance
// (unlike recordWeakPoolRecovery()'s case), so it goes back into the pool at
// the short WEAK_POOL_SWAP_COUNTDOWN regardless of whether there were any
// wrong attempts first. A pooled question swapped away again just has its
// countdown reset the same way, instead of being duplicated.
function recordWeakPoolSwap() {
  if (!weakPoolReviewEnabled) return;
  if (activePoolEntry) {
    activePoolEntry.countdown = WEAK_POOL_SWAP_COUNTDOWN;
    return;
  }
  pushToWeakPool(WEAK_POOL_SWAP_COUNTDOWN);
}

function newExercise() {
  tickWeakPool();
  const questionText = document.getElementById('questionText');
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const answer3 = document.getElementById('answer3');
  const answerHome = document.getElementById('answerHome');
  const answer2Home = document.getElementById('answer2Home');
  const answer3Home = document.getElementById('answer3Home');
  const simplifyLabel = document.getElementById('simplifyLabel');
  simplifyLabel.style.display = 'none';

  // Mobile numeric keypads (inputmode="numeric") often have no visible
  // Enter/Go key by default -- enterkeyhint gives them a real one. Defaults
  // to "done" (submit); the multi-blank branches below switch a box to
  // "next" wherever Enter there moves to the next box instead of submitting.
  answerInput.setAttribute('enterkeyhint', 'done');
  answer2.setAttribute('enterkeyhint', 'done');
  answer3.setAttribute('enterkeyhint', 'done');

  // Park the numeric-answer inputs back in their neutral home before any
  // topic-specific branch below rewrites questionText's markup -- otherwise
  // a topic that doesn't reuse them (compare-fractions) would destroy them
  // along with whatever old subtree they were still sitting in from a
  // previous numeric round (multAnswerSlot/fracAnswerSlot), leaving
  // #answer/#answer2/#answer3 permanently detached from the page and
  // crashing the next numeric round's startGame(). #answer3 is only ever
  // moved out of its home by mixed-numbers level 3 (see below) -- every
  // other branch leaves it here undisturbed.
  answerHome.appendChild(answerInput);
  answer2Home.appendChild(answer2);
  answer3Home.appendChild(answer3);

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
  const isVocabulary = gameMode === 'vocabulary';
  const isGrammar = gameMode === 'grammar';
  const isLetterFamily = isLetters || isAbc || isNikud;
  const isReverse = isLetterReverseMode(); // always false for nikud -- no reverse direction yet
  // Vocabulary level 4 (typed answer) is the one vocabulary level that needs
  // checkBtn -- every other vocabulary level answers immediately on a choice
  // click, same reasoning as isLetterFamily's !isReverse above (only the
  // levels with a genuine separate confirm step need it shown).
  const isVocabularyTyped = isVocabulary && isVocabularyTypedMode();
  document.getElementById('mathQuestionRow').style.display = (isLetterFamily || isVocabulary || isGrammar) ? 'none' : '';
  answerHome.style.display = (isLetterFamily || isCompare || isVocabulary || isGrammar) ? 'none' : '';
  // Grammar is typed-only (like vocabulary level 4) -- checkBtn/swapBtn are
  // always shown for it, same as isVocabularyTyped, never hidden the way
  // vocabulary's multiple-choice levels hide them.
  document.getElementById('checkBtn').style.display = ((isLetterFamily && !isReverse) || isCompare || (isVocabulary && !isVocabularyTyped)) ? 'none' : '';
  // Same reasoning as checkBtn just above: only vocabulary level 4 and
  // grammar have a typed answer worth paying coins to reveal/skip, the same
  // escape hatch every other typed-answer (non-multiple-choice) topic
  // already has.
  document.getElementById('swapBtn').style.display = (isLetterFamily || isCompare || (isVocabulary && !isVocabularyTyped)) ? 'none' : '';
  document.getElementById('lettersAnswerHome').style.display = isLetterFamily ? '' : 'none';
  document.getElementById('compareAnswerHome').style.display = isCompare ? '' : 'none';
  document.getElementById('vocabularyAnswerHome').style.display = isVocabulary ? '' : 'none';
  document.getElementById('grammarAnswerHome').style.display = isGrammar ? '' : 'none';

  if (isVocabulary) {
    const ex = pickExercise(generateVocabularyExercise);
    currentVocabularyAnswer = ex.correct;
    renderVocabularyChoices(ex);
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    return;
  }

  if (isGrammar) {
    const ex = pickExercise(generateGrammarExercise);
    currentGrammarAnswer = ex.correct;
    renderGrammarExercise(ex);
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    return;
  }
  // Swaps in a font where uppercase I and lowercase l are actually visually
  // distinct (see the .abc-mode rule in style.css) -- only relevant for the
  // Latin alphabet, so scoped to abc mode rather than applied to the
  // Hebrew-letters/nikud glyphs sharing these same elements.
  document.getElementById('lettersAnswerHome').classList.toggle('abc-mode', isAbc);

  if (isCompare) {
    const ex = pickExercise(generateCompareFractionsExercise);
    currentCompareAnswer = ex.correct;
    questionText.innerHTML =
      '<span class="frac-eq compare-eq">' +
        fractionBlockHTML(ex.leftNum, ex.leftDen) +
        '<span class="compare-blank" id="compareBlank"></span>' +
        fractionBlockHTML(ex.rightNum, ex.rightDen) +
      '</span>';
    renderCompareChoices(exerciseDifficultyIndex + 1 >= 3 ? COMPARE_OPTIONS_WITH_EQUAL : COMPARE_OPTIONS);
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    return;
  }

  if (isLetterFamily) {
    document.getElementById('letterListenMode').style.display = isReverse ? 'none' : '';
    document.getElementById('letterRevealMode').style.display = isReverse ? '' : 'none';
    const ex = pickExercise(isAbc ? generateAbcExercise : (isNikud ? generateNikudExercise : generateLetterExercise));
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

  if (gameMode === 'mixednumbers') {
    const ex = pickExercise(generateMixedNumberExercise);
    currentAnswer = ex.answer;
    if (ex.direction === 'toImproper') {
      // Level 2: given mixed number, one blank (the improper numerator) --
      // same single-blank template every other fraction topic's level 1 uses.
      questionText.innerHTML =
        '<span class="frac-eq">' +
          mixedNumberDisplayHTML(ex.shownWhole, ex.shownRemainderNumerator, ex.shownDenominator) +
          '<span class="frac-op">=</span>' +
          fractionAnswerBlockHTML('numerator', ex.targetNumerator, ex.targetDenominator) +
        '</span>';
      answerInput.classList.remove('mixed-whole-input');
      answerInput.classList.add('fraction-answer-input');
      const slot = document.getElementById('fracAnswerSlot');
      slot.prepend(answerInput);
      answer2.classList.remove('fraction-answer-input');
      answer2Home.appendChild(answer2);
    } else if (ex.direction === 'toImproperReduced') {
      // Level 4: like level 2's mixed-to-improper conversion (w given,
      // shown as plain text, never a blank), but the resulting improper
      // fraction may need reducing -- both boxes blank, same "both blank"
      // stacked template every other reduction level in this app uses
      // (addfractions level 2 etc.) -- #answer/#answer2 get the ordinary
      // generic keyboard treatment for this shape, no mixed-numbers-specific
      // wiring needed (see isMixedNumberWholeBoxLevel() in
      // exercise-mixednumbers.js).
      simplifyLabel.style.display = '';
      questionText.innerHTML =
        '<span class="frac-eq">' +
          mixedNumberDisplayHTML(ex.shownWhole, ex.shownRemainderNumerator, ex.shownDenominator) +
          '<span class="frac-op">=</span>' +
          fractionAnswerBlockHTML('both', ex.targetNumerator, ex.targetDenominator) +
        '</span>';
      answerInput.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer2
      answerInput.classList.remove('mixed-whole-input');
      answerInput.classList.add('fraction-answer-input');
      const slot = document.getElementById('fracAnswerSlot');
      slot.insertBefore(answerInput, slot.querySelector('.frac-bar'));
      answer2.classList.add('fraction-answer-input');
      slot.appendChild(answer2);
    } else if (ex.direction === 'toMixedReduced') {
      // Level 3: like level 1's improper-to-mixed decomposition (same
      // #answer whole-number box, same behavior -- blank legitimately
      // asserts 0, see checkMixedNumberReducedAnswer() in
      // exercise-mixednumbers.js), but the remainder fraction may need
      // reducing too, so it takes *two* boxes (#answer2 numerator, #answer3
      // denominator -- the app's first three-blank exercise) instead of
      // level 1's single fixed-denominator box. Composes level 1's own
      // mixedWholeSlot idea with the standard "both blank" fraction
      // template every other reduction level in this app already uses.
      simplifyLabel.style.display = '';
      questionText.innerHTML =
        '<span class="frac-eq">' +
          fractionBlockHTML(ex.improperNumerator, ex.improperDenominator) +
          '<span class="frac-op">=</span>' +
          '<span class="mixed-num-group">' +
            '<span id="mixedWholeSlot"></span>' +
            fractionAnswerBlockHTML('both', ex.targetNumerator, ex.targetDenominator) +
          '</span>' +
        '</span>';
      answerInput.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer2
      answer2.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer3
      answerInput.classList.remove('fraction-answer-input');
      answerInput.classList.add('mixed-whole-input');
      document.getElementById('mixedWholeSlot').appendChild(answerInput);
      answer2.classList.add('fraction-answer-input');
      answer3.classList.add('fraction-answer-input');
      const slot = document.getElementById('fracAnswerSlot');
      slot.insertBefore(answer2, slot.querySelector('.frac-bar'));
      slot.appendChild(answer3);
    } else {
      // Level 1: given improper fraction, two blanks (whole + remainder).
      questionText.innerHTML =
        '<span class="frac-eq">' +
          fractionBlockHTML(ex.improperNumerator, ex.improperDenominator) +
          '<span class="frac-op">=</span>' +
          mixedNumberAnswerBlockHTML(ex.targetDenominator) +
        '</span>';
      answerInput.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer2 instead of submitting
      answerInput.classList.remove('fraction-answer-input');
      answerInput.classList.add('mixed-whole-input'); // narrower box -- w is always a single digit (0-MIXED_NUM_WHOLE_MAX), see config.js
      const wholeSlot = document.getElementById('mixedWholeSlot');
      const fracSlot = document.getElementById('mixedFracSlot');
      wholeSlot.appendChild(answerInput);
      answer2.classList.add('fraction-answer-input'); // remainder box: fraction-slot sizing
      fracSlot.insertBefore(answer2, fracSlot.querySelector('.frac-bar'));
    }
  } else if (gameMode === 'addfractionsadvanced') {
    const ex = pickExercise(generateFractionAdditionAdvancedExercise);
    currentAnswer = ex.answer;
    // Levels 3-4 show both addends as given mixed numbers instead of plain
    // fractions (W=0 shown as a plain fraction with no whole part -- same
    // "never write a literal zero whole part" convention mixed-numbers
    // already established for a *typed* answer, applied here to a *shown*
    // given instead). Levels 1-2 show plain fractions. Shared across both
    // the two-box and three-box answer templates below, since which addends
    // are shown is independent of whether the *answer* needs reducing.
    const showsMixedAddends = isAddFractionsAdvancedLevel3() || isAddFractionsAdvancedLevel4();
    const leftAddendHTML = showsMixedAddends
      ? (ex.pWhole === 0 ? fractionBlockHTML(ex.pNum, ex.pDen) : mixedNumberDisplayHTML(ex.pWhole, ex.pNum, ex.pDen))
      : fractionBlockHTML(ex.pNum, ex.pDen);
    const rightAddendHTML = showsMixedAddends
      ? (ex.qWhole === 0 ? fractionBlockHTML(ex.qNum, ex.qDen) : mixedNumberDisplayHTML(ex.qWhole, ex.qNum, ex.qDen))
      : fractionBlockHTML(ex.qNum, ex.qDen);
    if (isAddFractionsAdvancedLevel2() || isAddFractionsAdvancedLevel4()) {
      // Levels 2/4: the remainder fraction may need reducing, so it takes
      // *two* boxes (#answer2 numerator, #answer3 denominator) instead of
      // the single fixed-denominator box levels 1/3 use -- same composition
      // mixed-numbers level 3 uses (mixedWholeSlot + the standard "both
      // blank" fraction template).
      simplifyLabel.style.display = '';
      questionText.innerHTML =
        '<span class="frac-eq">' +
          leftAddendHTML +
          '<span class="frac-op">+</span>' +
          rightAddendHTML +
          '<span class="frac-op">=</span>' +
          '<span class="mixed-num-group">' +
            '<span id="mixedWholeSlot"></span>' +
            fractionAnswerBlockHTML('both', ex.targetNumerator, ex.targetDenominator) +
          '</span>' +
        '</span>';
      answerInput.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer2
      answer2.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer3
      answerInput.classList.remove('fraction-answer-input');
      answerInput.classList.add('mixed-whole-input');
      document.getElementById('mixedWholeSlot').appendChild(answerInput);
      answer2.classList.add('fraction-answer-input');
      answer3.classList.add('fraction-answer-input');
      const slot = document.getElementById('fracAnswerSlot');
      slot.insertBefore(answer2, slot.querySelector('.frac-bar'));
      slot.appendChild(answer3);
    } else {
      // Levels 1/3: the target is a mixed number (whole + remainder over the
      // fixed denominator) instead of a single blank numerator -- reuses
      // mixedNumberAnswerBlockHTML() and the exact same #mixedWholeSlot/
      // #mixedFracSlot DOM wiring as mixed-numbers level 1 below, since the
      // answer shape is identical ({whole, remainderNumerator}).
      questionText.innerHTML =
        '<span class="frac-eq">' +
          leftAddendHTML +
          '<span class="frac-op">+</span>' +
          rightAddendHTML +
          '<span class="frac-op">=</span>' +
          mixedNumberAnswerBlockHTML(ex.targetDenominator) +
        '</span>';
      answerInput.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer2 instead of submitting
      answerInput.classList.remove('fraction-answer-input');
      answerInput.classList.add('mixed-whole-input');
      const wholeSlot = document.getElementById('mixedWholeSlot');
      const fracSlot = document.getElementById('mixedFracSlot');
      wholeSlot.appendChild(answerInput);
      answer2.classList.add('fraction-answer-input');
      fracSlot.insertBefore(answer2, fracSlot.querySelector('.frac-bar'));
    }
  } else if (gameMode === 'addfractions') {
    const ex = pickExercise(generateFractionAdditionExercise);
    currentAnswer = ex.answer;
    if (isFractionAdditionScaffoldLevel()) {
      // Level 3 scaffold: the given problem shown plain (no result) on its
      // own row, then the same problem again underneath with whichever side
      // needed expanding rewritten over the shared denominator -- two
      // separate blanks (#answer for the expanded numerator, #answer2 for
      // the sum's own numerator) in two different fraction slots, so this
      // doesn't fit renderFractionAnswerEquation()'s single "shown = blank"
      // template. Row order mirrors the given row's own left/right
      // placement (whichever of pNum/pDen or qNum/qDen is the expand side),
      // so the same fraction stays on the same side across both lines.
      const givenRowHTML = fractionBlockHTML(ex.pNum, ex.pDen) + '<span class="frac-op">+</span>' + fractionBlockHTML(ex.qNum, ex.qDen) + '<span class="frac-op">=</span>';
      const expandSlotHTML = `<span class="frac-block frac-answer-block" id="fracAnswerSlot"><span class="frac-bar"></span><span class="frac-den">${ex.targetDenominator}</span></span>`;
      const matchedFractionHTML = fractionBlockHTML(ex.pIsExpandSide ? ex.qNum : ex.pNum, ex.targetDenominator);
      const expandedRowHTML =
        (ex.pIsExpandSide
          ? expandSlotHTML + '<span class="frac-op">+</span>' + matchedFractionHTML
          : matchedFractionHTML + '<span class="frac-op">+</span>' + expandSlotHTML) +
        '<span class="frac-op">=</span>' +
        `<span class="frac-block frac-answer-block" id="fracScaffoldResultSlot"><span class="frac-bar"></span><span class="frac-den">${ex.targetDenominator}</span></span>`;
      questionText.innerHTML =
        '<span class="frac-eq-stack">' +
          `<span class="frac-eq">${givenRowHTML}</span>` +
          `<span class="frac-eq">${expandedRowHTML}</span>` +
        '</span>';
      answerInput.setAttribute('enterkeyhint', 'next'); // Enter moves to #answer2
      answerInput.classList.add('fraction-answer-input');
      const expandSlot = document.getElementById('fracAnswerSlot');
      expandSlot.insertBefore(answerInput, expandSlot.querySelector('.frac-bar'));
      answer2.classList.add('fraction-answer-input');
      const resultSlot = document.getElementById('fracScaffoldResultSlot');
      resultSlot.insertBefore(answer2, resultSlot.querySelector('.frac-bar'));
    } else {
      const shownHTML = fractionBlockHTML(ex.pNum, ex.pDen) + '<span class="frac-op">+</span>' + fractionBlockHTML(ex.qNum, ex.qDen);
      renderFractionAnswerEquation(shownHTML, ex, questionText, answerInput, answer2, answer2Home, simplifyLabel);
    }
  } else if (gameMode === 'subtractfractions') {
    const ex = pickExercise(generateFractionSubtractionExercise);
    currentAnswer = ex.answer;
    const shownHTML = fractionBlockHTML(ex.pNum, ex.pDen) + '<span class="frac-op">−</span>' + fractionBlockHTML(ex.qNum, ex.qDen);
    renderFractionAnswerEquation(shownHTML, ex, questionText, answerInput, answer2, answer2Home, simplifyLabel);
  } else if (gameMode === 'fractions') {
    const ex = pickExercise(generateFractionExercise);
    currentAnswer = ex.answer;
    const shownHTML = fractionBlockHTML(ex.shownNumerator, ex.shownDenominator);
    renderFractionAnswerEquation(shownHTML, ex, questionText, answerInput, answer2, answer2Home, simplifyLabel);
  } else if (gameMode === 'division') {
    // Same "num1 × num2 = [blank]" template multiplication uses, just with
    // the blank moved onto whichever factor generateDivisionIntroExercise()
    // picked instead of the product -- see that function's own comment.
    const ex = pickExercise(generateDivisionIntroExercise);
    currentAnswer = ex.answer;
    const shown = ex.missing === 'first' ? ex.num2 : ex.num1;
    questionText.innerHTML = ex.missing === 'first'
      ? `<span class="mult-eq"><span id="multAnswerSlot"></span> × ${shown}<span class="mult-op">=</span>${ex.product}</span>`
      : `<span class="mult-eq">${shown} × <span id="multAnswerSlot"></span><span class="mult-op">=</span>${ex.product}</span>`;
    answerInput.classList.remove('fraction-answer-input');
    answerInput.classList.add('division-answer-input');
    document.getElementById('multAnswerSlot').appendChild(answerInput);
    answer2.classList.remove('fraction-answer-input');
    answer2Home.appendChild(answer2);
  } else {
    // No generate*Exercise() of its own -- pickNumbers() is wrapped inline
    // so multiplication still routes through pickExercise() like every other
    // topic, keeping it eligible for the weak pool too.
    const ex = pickExercise(() => { const [n1, n2] = pickNumbers(); return { num1: n1, num2: n2 }; });
    [num1, num2] = [ex.num1, ex.num2];
    currentAnswer = num1 * num2;
    questionText.innerHTML = `<span class="mult-eq">${num1} × ${num2}<span class="mult-op">=</span><span id="multAnswerSlot"></span></span>`;
    answerInput.classList.remove('fraction-answer-input');
    document.getElementById('multAnswerSlot').appendChild(answerInput);
    answer2.classList.remove('fraction-answer-input');
    answer2Home.appendChild(answer2);
  }

  answerInput.value = '';
  answer2.value = '';
  answer3.value = '';
  answerInput.classList.remove('answer-revealed');
  answer2.classList.remove('answer-revealed');
  answer3.classList.remove('answer-revealed');
  answerInput.classList.remove('answer-left-blank');
  if (gameMode !== 'mixednumbers' && gameMode !== 'addfractionsadvanced') answerInput.classList.remove('mixed-whole-input');
  if (gameMode !== 'division') answerInput.classList.remove('division-answer-input');
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

// Every exercise type (numeric, letters, letters-reverse, compare-fractions)
// calls one of these the instant an answer is judged right/wrong -- coins,
// the feedback message, and the floating +10/-5 popup are identical across
// all of them. What happens *after* (retry the same question vs. move on,
// which elements get disabled) still differs per type, so that part stays
// in each topic file's own check*Answer() function.
function markCorrect(anchorEl) {
  const feedback = document.getElementById('feedback');
  feedback.textContent = 'נכון';
  feedback.className = 'feedback correct';
  playerMoney = Math.min(MAX_COINS, playerMoney + CORRECT_REWARD);
  correctCount++;
  recordWeakPoolRecovery();
  updateCoinsDisplay();
  updateStatsCountersDisplay();
  showFloatingText(`+${CORRECT_REWARD}`, 'positive', anchorEl);
}

function markWrong(anchorEl, message = 'לא נכון, נסה שוב') {
  const feedback = document.getElementById('feedback');
  feedback.textContent = message;
  feedback.className = 'feedback incorrect';
  playerMoney -= WRONG_PENALTY;
  wrongCount++;
  recordWeakPoolMistake();
  updateCoinsDisplay();
  updateStatsCountersDisplay();
  showFloatingText(`-${WRONG_PENALTY}`, 'negative', anchorEl);
}

function checkAnswer() {
  if (gameOver) return;

  if (isVocabularyTypedMode()) {
    checkVocabularyTypedAnswer();
    return;
  }

  if (gameMode === 'grammar') {
    checkGrammarAnswer();
    return;
  }

  if (isLetterReverseMode()) {
    checkLetterReverseAnswer();
    return;
  }

  if (gameMode === 'mixednumbers') {
    checkMixedNumberAnswer();
    return;
  }

  if (gameMode === 'addfractionsadvanced') {
    checkFractionAdditionAdvancedAnswer();
    return;
  }

  if (isFractionAdditionScaffoldLevel()) {
    checkFractionAdditionScaffoldAnswer();
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
    markCorrect(answerInput);

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
    markWrong(answerInput);

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

  // Vocabulary level 4 has its own typed-answer input rather than the
  // generic #answer/#answer2/#answer3 the rest of this function operates
  // on -- dispatched out the same way checkVocabularyTypedAnswer() is
  // dispatched from checkAnswer().
  if (isVocabularyTypedMode()) {
    changeVocabularyTypedQuestion();
    return;
  }

  if (gameMode === 'grammar') {
    changeGrammarQuestion();
    return;
  }

  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const answer3 = document.getElementById('answer3');
  if (swapBtn.disabled) return; // already mid-reveal

  playerMoney -= SWAP_QUESTION_COST;
  swapCount++;
  recordWeakPoolSwap();
  updateCoinsDisplay();
  updateStatsCountersDisplay();
  showFloatingText(`-${SWAP_QUESTION_COST}`, 'negative', swapBtn);

  swapBtn.disabled = true;
  checkBtn.disabled = true;
  answerInput.disabled = true;
  answer2.disabled = true;
  answer3.disabled = true;

  // Fill the blank(s) themselves in red, in place -- most exercise types
  // show the answer inside the equation now, so this is the same for them.
  // Mixed-numbers level 1 and addfractionsadvanced levels 1/3 are the one
  // shape that doesn't fit the generic two-blank branch: currentAnswer there
  // is {whole, remainderNumerator}, not {numerator, denominator}
  // (isTwoBoxWholeAnswerLevel()). Mixed-numbers level 3 and addfractionsadvanced
  // level 2 don't fit either shape -- it's {whole, numerator, denominator}
  // across *three* boxes -- so they get their own branch too
  // (isThreeBoxAnswerLevel()). addfractions level 3 (the expand-to-common-
  // denominator scaffold) doesn't fit either: its answer is
  // {expandedNumerator, targetNumerator}, two ordinary required blanks in
  // two different fraction slots rather than one fraction's own
  // numerator+denominator (isFractionAdditionScaffoldLevel(), exercise-addfractions.js).
  // Mixed-numbers level 2's answer is a plain number, which the generic
  // branch already handles (see checkMixedNumberAnswer() in
  // exercise-mixednumbers.js for the matching level-based validation split).
  const isTwoBlank = typeof currentAnswer === 'object';
  answerInput.classList.remove('answer-left-blank');
  if (isTwoBoxWholeAnswerLevel()) {
    answerInput.value = currentAnswer.whole;
    answer2.value = currentAnswer.remainderNumerator;
    answer2.classList.add('answer-revealed');
  } else if (isThreeBoxAnswerLevel()) {
    answerInput.value = currentAnswer.whole;
    answer2.value = currentAnswer.numerator;
    answer3.value = currentAnswer.denominator;
    answer2.classList.add('answer-revealed');
    answer3.classList.add('answer-revealed');
  } else if (isFractionAdditionScaffoldLevel()) {
    answerInput.value = currentAnswer.expandedNumerator;
    answer2.value = currentAnswer.targetNumerator;
    answer2.classList.add('answer-revealed');
  } else {
    answerInput.value = isTwoBlank ? currentAnswer.numerator : currentAnswer;
    if (isTwoBlank) {
      answer2.value = currentAnswer.denominator;
      answer2.classList.add('answer-revealed');
    }
  }
  answerInput.classList.add('answer-revealed');

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  swapTimeoutId = setTimeout(() => {
    checkBtn.disabled = false;
    answerInput.disabled = false;
    answer2.disabled = false;
    answer3.disabled = false;
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
  document.getElementById('buyBtn').disabled = playerMoney < SOLDIER_COST || gameOver || isStudyMode();
}

// Updates the small in-play counters (.top-stats-row). The same
// correctCount/wrongCount/swapCount values get read directly by endGame()
// in main.js to populate the bigger win/lose-screen versions once, since
// those are static after gameOver -- no live-updating needed there.
function updateStatsCountersDisplay() {
  document.getElementById('correctCountDisplay').textContent = correctCount;
  document.getElementById('wrongCountDisplay').textContent = wrongCount;
  document.getElementById('swapCountDisplay').textContent = swapCount;
}
