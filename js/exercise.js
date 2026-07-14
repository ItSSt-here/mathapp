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

  if (gameMode === 'fractions') {
    const ex = generateFractionExercise();
    currentAnswer = ex.answer;
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
    questionText.textContent = `${num1} × ${num2}`;
    answerInput.classList.remove('fraction-answer-input');
    document.getElementById('answerHome').appendChild(answerInput);
    answer2.classList.remove('fraction-answer-input');
    answer2Home.appendChild(answer2);
  }

  document.getElementById('answerReveal').textContent = '';
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

  if (gameMode === 'fractions') {
    // Fill the blank(s) themselves in red instead of a floating "= X" next
    // to the equation -- that read oddly once the answer lives inside the
    // fraction layout rather than in a separate box below the question.
    const isTwoBlank = typeof currentAnswer === 'object';
    answerInput.value = isTwoBlank ? currentAnswer.numerator : currentAnswer;
    answerInput.classList.add('answer-revealed');
    if (isTwoBlank) {
      answer2.value = currentAnswer.denominator;
      answer2.classList.add('answer-revealed');
    }
  } else {
    document.getElementById('answerReveal').textContent = `= ${currentAnswer}`;
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
