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

function newExercise() {
  const questionText = document.getElementById('questionText');
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const answerHome = document.getElementById('answerHome');
  const answer2Home = document.getElementById('answer2Home');
  const simplifyLabel = document.getElementById('simplifyLabel');
  simplifyLabel.style.display = 'none';

  // Mobile numeric keypads (inputmode="numeric") often have no visible
  // Enter/Go key by default -- enterkeyhint gives them a real one. Defaults
  // to "done" (submit); the two-blank branches below switch #answer to
  // "next" since Enter there moves to #answer2 instead of submitting.
  answerInput.setAttribute('enterkeyhint', 'done');
  answer2.setAttribute('enterkeyhint', 'done');

  // Park the numeric-answer inputs back in their neutral home before any
  // topic-specific branch below rewrites questionText's markup -- otherwise
  // a topic that doesn't reuse them (compare-fractions) would destroy them
  // along with whatever old subtree they were still sitting in from a
  // previous numeric round (multAnswerSlot/fracAnswerSlot), leaving
  // #answer/#answer2 permanently detached from the page and crashing the
  // next numeric round's startGame().
  answerHome.appendChild(answerInput);
  answer2Home.appendChild(answer2);

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
  answerHome.style.display = (isLetterFamily || isCompare) ? 'none' : '';
  document.getElementById('checkBtn').style.display = ((isLetterFamily && !isReverse) || isCompare) ? 'none' : '';
  document.getElementById('swapBtn').style.display = (isLetterFamily || isCompare) ? 'none' : '';
  document.getElementById('lettersAnswerHome').style.display = isLetterFamily ? '' : 'none';
  document.getElementById('compareAnswerHome').style.display = isCompare ? '' : 'none';
  // Swaps in a font where uppercase I and lowercase l are actually visually
  // distinct (see the .abc-mode rule in style.css) -- only relevant for the
  // Latin alphabet, so scoped to abc mode rather than applied to the
  // Hebrew-letters/nikud glyphs sharing these same elements.
  document.getElementById('lettersAnswerHome').classList.toggle('abc-mode', isAbc);

  if (isCompare) {
    const ex = generateCompareFractionsExercise();
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

  if (gameMode === 'addfractions') {
    const ex = generateFractionAdditionExercise();
    currentAnswer = ex.answer;
    if (ex.missing === 'both') simplifyLabel.style.display = '';
    questionText.innerHTML =
      '<span class="frac-eq">' +
        fractionBlockHTML(ex.pNum, ex.pDen) +
        '<span class="frac-op">+</span>' +
        fractionBlockHTML(ex.qNum, ex.qDen) +
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
      slot.prepend(answerInput);
      answer2.classList.remove('fraction-answer-input');
      answer2Home.appendChild(answer2);
    }
  } else if (gameMode === 'fractions') {
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
      answerInput.setAttribute('enterkeyhint', 'next');
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
  playerMoney += CORRECT_REWARD;
  correctCount++;
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
  updateCoinsDisplay();
  updateStatsCountersDisplay();
  showFloatingText(`-${WRONG_PENALTY}`, 'negative', anchorEl);
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

  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  if (swapBtn.disabled) return; // already mid-reveal

  playerMoney -= SWAP_QUESTION_COST;
  swapCount++;
  updateCoinsDisplay();
  updateStatsCountersDisplay();
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

// Updates the small in-play counters (.top-stats-row). The same
// correctCount/wrongCount/swapCount values get read directly by endGame()
// in main.js to populate the bigger win/lose-screen versions once, since
// those are static after gameOver -- no live-updating needed there.
function updateStatsCountersDisplay() {
  document.getElementById('correctCountDisplay').textContent = correctCount;
  document.getElementById('wrongCountDisplay').textContent = wrongCount;
  document.getElementById('swapCountDisplay').textContent = swapCount;
}
