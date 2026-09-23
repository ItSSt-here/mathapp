// ---------- Decimals exercise ----------
// Level 1 (the only level so far): a mixed number (whole + proper fraction,
// denominator always 10/100/1000) is shown, and the student types its
// decimal form freehand (e.g. "3.05") into #decimalTypedInput -- same
// typed-answer/checkBtn mechanic as grammar/vocabulary-level-4, just its own
// dedicated input since a decimal separator doesn't fit the digit-only
// filter every other numeric topic's #answer box uses. See the DECIMAL_*
// constants in config.js for the tunable ranges/chances.

// Correct answer (a decimal string, e.g. "3.05") for whatever exercise is
// currently on screen.
let currentDecimalAnswer = null;

// Picks how many digits the numerator gets, per DECIMAL_L1_* comment in
// config.js: denominator 10 has no real choice (a proper, non-multiple-of-10
// numerator under 10 is always a single digit); 100 splits 50/50 between one
// and two digits; 1000 splits 25/25/50 across one/two/three digits.
function pickDecimalNumeratorDigitCount(denominator) {
  if (denominator === 10) return 1;
  if (denominator === 100) return Math.random() < 0.5 ? 1 : 2;
  const r = Math.random();
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  return 3;
}

// Draws a numerator with exactly digitCount digits that's never a multiple
// of 10 -- guaranteed by construction (the last digit is always drawn from
// 1-9) rather than by drawing-then-rejecting, see [[feedback_no_reroll_mechanics]].
// Leading digit drawn from 1-9 too, so the digit count is exact (no leading
// zero shrinking a "two-digit" draw down to one digit).
function drawDecimalNumerator(digitCount) {
  if (digitCount === 1) return randInt(1, 9);
  if (digitCount === 2) return randInt(1, 9) * 10 + randInt(1, 9);
  return randInt(1, 9) * 100 + randInt(0, 9) * 10 + randInt(1, 9);
}

// Smallest power of ten a given denominator divides evenly -- 2/5/10 -> 10,
// 20/25/50/100 -> 100, 4 -> 100, 8 -> 1000. Genuinely searches/checks
// divisibility instead of a "denominator<=10?10:100" shortcut: that shortcut
// happens to work for level 2's own pool, but breaks for level 3's harder
// denominators (4<=10, yet 10%4 isn't 0 -- it needs 100, not 10). Every
// denominator this topic ever draws is built purely from 2s and 5s, so this
// always terminates -- see DECIMAL_L3_HARD_DENOMINATORS's own comment in
// config.js for why a denominator like 15 (with a factor of 3) could never
// be used here at all, loop or no loop.
function decimalExpansionTarget(denominator) {
  let target = 10;
  while (target % denominator !== 0) target *= 10;
  return target;
}

// Shared by every level: given the whole part and the shown fraction's own
// numerator/denominator, expands to the smallest terminating power-of-ten
// form and builds the final answer string. padStart is exactly what
// supplies the "connecting zero(s)" every level's harder draws are built to
// drill (e.g. numerator=3, denominator=100 -> "03" -> 0.03).
function buildDecimalAnswer(whole, numerator, denominator) {
  const target = decimalExpansionTarget(denominator);
  const multiplier = target / denominator;
  const places = String(target).length - 1;
  const expandedNumerator = numerator * multiplier;
  const decimalDigits = String(expandedNumerator).padStart(places, '0');
  return `${whole}.${decimalDigits}`;
}

function generateDecimalLevel1Exercise() {
  const forceZero = Math.random() < DECIMAL_L1_ZERO_CHANCE;
  const whole = forceZero ? 0 : randInt(1, DECIMAL_WHOLE_MAX);
  const denominator = randChoice(DECIMAL_DENOMINATORS);
  const digitCount = pickDecimalNumeratorDigitCount(denominator);
  const numerator = drawDecimalNumerator(digitCount);

  return {
    whole, numerator, denominator,
    answer: buildDecimalAnswer(whole, numerator, denominator),
  };
}

// ---------- Level 2: Hebrew fraction names ----------
// Converts a numerator into Hebrew number-words (feminine gender -- every
// noun this function's result ever attaches to, עשיריות/מאיות/אלפיות/
// חמישיות/שמיניות, is grammatically feminine). Verified against a
// standalone checker artifact before shipping (see
// [[project_decimals_topic_plan]] in memory for the review process) --
// covers 1-999, since a thousandths numerator can be up to three digits.

// FEM_UNITS[2] is the *absolute* form ("שתיים") -- correct whenever "two"
// is part of a larger compound (22, 102, ...). FEM_TWO_STANDALONE ("שתי")
// is the *bound/construct* form, correct only when "two" is the entire
// number on its own, directly before the noun (e.g. "שתי מאיות"). Every
// other digit uses the same word either way. Confirmed directly with the
// user after an initial draft used the bound form everywhere -- "עשרים
// ושתי מאיות" is wrong, it needs to be "עשרים ושתיים מאיות".
const FEM_UNITS = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const FEM_TWO_STANDALONE = 'שתי';
const FEM_TEENS = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const FEM_TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const HEBREW_HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];

// Builds the ordered word-components (not yet joined) for 1-999.
function hebrewFemininePartsList(n) {
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts = [];
  if (h > 0) parts.push(HEBREW_HUNDREDS[h]);
  if (rem > 0) {
    if (rem < 10) {
      // rem is the *entire* number only if there's no hundreds component
      // either -- that's the one case using the standalone "שתי" for 2.
      const isEntireNumber = h === 0;
      parts.push(rem === 2 && isEntireNumber ? FEM_TWO_STANDALONE : FEM_UNITS[rem]);
    } else if (rem < 20) {
      parts.push(FEM_TEENS[rem - 10]);
    } else {
      const t = Math.floor(rem / 10);
      const u = rem % 10;
      parts.push(FEM_TENS[t]);
      if (u > 0) parts.push(FEM_UNITS[u]); // always compound here (tens present) -- absolute form
    }
  }
  return parts;
}

// The Hebrew "vav" (ו) conjunction attaches only to the *last* component of
// a compound number, never between earlier ones -- e.g. 123 is "מאה עשרים
// ושלוש" (vav only before the final "שלוש"), not "מאה ועשרים ושלוש".
function joinHebrewParts(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(' ') + ' ו' + parts[parts.length - 1];
}

function hebrewNumberFeminine(n) {
  return joinHebrewParts(hebrewFemininePartsList(n));
}

// Masculine 2/3 -- only ever needed for רבעים (quarters), numerator 1-3.
const MASC_SMALL = { 2: 'שני', 3: 'שלושה' };

// singular alone for numerator 1 (that's literally what "חמישית"/"מאית"
// etc. already mean); numeral + plural otherwise. חצי has no plural at all
// since 2/2 is a whole, not a fraction case. עשירית/מאית/אלפית (the
// "constant" denominators) fold into this exact same table/rule -- there's
// no separate case needed for them beyond what's already here.
const FRACTION_WORDS = {
  2: { singular: 'חצי', plural: null, gender: 'fem' },
  4: { singular: 'רבע', plural: 'רבעים', gender: 'masc' },
  5: { singular: 'חמישית', plural: 'חמישיות', gender: 'fem' },
  8: { singular: 'שמינית', plural: 'שמיניות', gender: 'fem' },
  10: { singular: 'עשירית', plural: 'עשיריות', gender: 'fem' },
  100: { singular: 'מאית', plural: 'מאיות', gender: 'fem' },
  1000: { singular: 'אלפית', plural: 'אלפיות', gender: 'fem' },
};

function fractionNameHebrew(numerator, denominator) {
  const info = FRACTION_WORDS[denominator];
  if (numerator === 1) return info.singular;
  if (info.gender === 'masc') return `${MASC_SMALL[numerator]} ${info.plural}`;
  return `${hebrewNumberFeminine(numerator)} ${info.plural}`;
}

// Digit-count split for the "constant" denominators (10/100/1000) --
// deliberately its *own* distribution, confirmed directly with the user,
// not reused from pickDecimalNumeratorDigitCount() above despite the
// superficial similarity: 100 happens to match that function's own 50/50
// split, but 1000 splits evenly in *thirds* here (not that function's
// 25/25/50). 10 has no real choice (numerator 1-9 is always a single
// digit). Feeds into the existing drawDecimalNumerator() for the actual
// construction (still guaranteeing "never a multiple of 10" by the same
// last-digit-1-to-9 construction, see that function's own comment).
function pickFractionNameDigitCount(denominator) {
  if (denominator === 10) return 1;
  if (denominator === 100) return Math.random() < 0.5 ? 1 : 2;
  const r = Math.random();
  if (r < 1 / 3) return 1;
  if (r < 2 / 3) return 2;
  return 3;
}

// Correct exercise object for the currently-shown Hebrew name -- checked
// against directly, unlike every other decimals level's currentDecimalAnswer
// (a plain decimal string), since this level needs the numerator/denominator
// too, not just the final decimal value.
let currentDecimalFractionNameExercise = null;

function generateDecimalFractionNameExercise() {
  const r = Math.random();
  let denominator, numerator;
  if (r < DECIMAL_FRACTION_NAME_SPECIAL_CHANCE) {
    denominator = randChoice(DECIMAL_FRACTION_NAME_SPECIAL_DENOMINATORS);
    numerator = randInt(1, denominator - 1);
  } else if (r < DECIMAL_FRACTION_NAME_SPECIAL_CHANCE + DECIMAL_FRACTION_NAME_HUNDREDTHS_CHANCE) {
    denominator = 100;
    numerator = drawDecimalNumerator(pickFractionNameDigitCount(denominator));
  } else if (r < DECIMAL_FRACTION_NAME_SPECIAL_CHANCE + DECIMAL_FRACTION_NAME_HUNDREDTHS_CHANCE + DECIMAL_FRACTION_NAME_THOUSANDTHS_CHANCE) {
    denominator = 1000;
    numerator = drawDecimalNumerator(pickFractionNameDigitCount(denominator));
  } else {
    denominator = 10;
    numerator = randInt(1, 9);
  }
  return {
    numerator, denominator,
    name: fractionNameHebrew(numerator, denominator),
    answer: buildDecimalAnswer(0, numerator, denominator),
  };
}

// Renders the Hebrew name as its own word-display (same role
// #grammarWordDisplay/#vocabularyWordDisplay play for their own topics --
// #mathQuestionRow is hidden for this level, see newExercise() in
// exercise-core.js, since there's no shown equation, only the name) and
// parks #answer/#answer2 (fraction numerator/denominator) plus
// #decimalTypedInput (decimal) into this level's own answer row -- three
// required boxes, all reused from elsewhere rather than duplicated.
function renderDecimalFractionNameExercise(ex) {
  document.getElementById('fractionNameWordDisplay').textContent = ex.name;

  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const decimalInput = document.getElementById('decimalTypedInput');

  answerInput.classList.add('fraction-answer-input');
  answer2.classList.add('fraction-answer-input');
  // Denominator alone can reach 1000 (thousandths) -- see the class's own
  // comment in style.css. Cleared again at the top of newExercise()
  // (exercise-core.js) so it doesn't linger on #answer2 for another topic.
  answer2.classList.add('decimal-fraction-name-denominator-input');
  answerInput.setAttribute('enterkeyhint', 'next');
  answer2.setAttribute('enterkeyhint', 'next');

  const slot = document.getElementById('fractionNameFracSlot');
  slot.insertBefore(answerInput, slot.querySelector('.frac-bar'));
  slot.appendChild(answer2);
  document.getElementById('fractionNameDecimalSlot').appendChild(decimalInput);

  answerInput.value = '';
  answer2.value = '';
  decimalInput.value = '';
  answerInput.classList.remove('answer-revealed');
  answer2.classList.remove('answer-revealed');
  decimalInput.classList.remove('answer-revealed');
  answerInput.focus();
}

// All three boxes required, checked together -- there's no partial credit
// for getting the fraction right but the decimal wrong (or vice versa),
// same "every blank required" convention every other multi-box exercise in
// this app uses. Decimal compared numerically, not as a string (see
// normalizeDecimalTypedAnswer()'s own comment above) -- same reasoning
// applies here as everywhere else in this topic.
function checkDecimalFractionNameAnswer() {
  if (gameOver) return;
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const decimalInput = document.getElementById('decimalTypedInput');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (answerInput.value.trim() === '' || answer2.value.trim() === '' || decimalInput.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const ex = currentDecimalFractionNameExercise;
  // Any fraction *equal in value* to ex.numerator/ex.denominator is accepted,
  // not just that exact pair -- e.g. the name "עשרים מאיות" draws
  // {numerator:20, denominator:100}, but a student who reduces on sight and
  // writes 1/5 is just as correct. Checked by cross-multiplication
  // (enteredNum/enteredDen === ex.numerator/ex.denominator, without
  // dividing) rather than reducing both sides -- also naturally accepts an
  // *expanded* equivalent (e.g. 40/200), not just a reduced one. Both
  // entered values must be positive -- otherwise 0/0 would cross-multiply to
  // a false "equal" (0 === 0) against any ex.numerator/ex.denominator.
  const enteredNumerator = parseInt(answerInput.value, 10);
  const enteredDenominator = parseInt(answer2.value, 10);
  const isCorrect =
    enteredNumerator > 0 && enteredDenominator > 0 &&
    enteredNumerator * ex.denominator === ex.numerator * enteredDenominator &&
    Number(normalizeDecimalTypedAnswer(decimalInput.value)) === Number(ex.answer);

  checkBtn.disabled = true;
  answerInput.disabled = true;
  answer2.disabled = true;
  decimalInput.disabled = true;

  if (isCorrect) {
    markCorrect(answerInput);
    setTimeout(() => {
      checkBtn.disabled = false;
      answerInput.disabled = false;
      answer2.disabled = false;
      decimalInput.disabled = false;
      newExercise();
    }, 800);
  } else {
    markWrong(answerInput);
    setTimeout(() => {
      answerInput.value = '';
      answer2.value = '';
      decimalInput.value = '';
      answerInput.disabled = false;
      answer2.disabled = false;
      decimalInput.disabled = false;
      checkBtn.disabled = false;
      answerInput.focus();
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 800);
  }
}

// Reveals all three correct values at once -- same cost/timing as every
// other topic's swap.
function changeDecimalFractionNameQuestion() {
  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const answerInput = document.getElementById('answer');
  const answer2 = document.getElementById('answer2');
  const decimalInput = document.getElementById('decimalTypedInput');
  if (swapBtn.disabled) return;

  chargeSwap(swapBtn);

  swapBtn.disabled = true;
  checkBtn.disabled = true;
  answerInput.disabled = true;
  answer2.disabled = true;
  decimalInput.disabled = true;

  const ex = currentDecimalFractionNameExercise;
  answerInput.value = ex.numerator;
  answer2.value = ex.denominator;
  decimalInput.value = ex.answer;
  answerInput.classList.add('answer-revealed');
  answer2.classList.add('answer-revealed');
  decimalInput.classList.add('answer-revealed');

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  swapTimeoutId = setTimeout(() => {
    checkBtn.disabled = false;
    answerInput.disabled = false;
    answer2.disabled = false;
    decimalInput.disabled = false;
    swapBtn.disabled = false;
    newExercise();
  }, SWAP_REVEAL_MS);
}

// Level 2's own numerator draw (see DECIMAL_L2_DENOMINATORS in config.js):
// denominators 50/100 get the same single-digit/two-digit split level 1
// uses for its own denom-100 case (no "never a multiple of 10" exclusion
// here, unlike level 1 -- see that constant's own comment); every other
// denominator (2/5/10/20/25) is just a uniform proper draw, no split at all
// -- 25 deliberately excluded from the split despite being just as capable
// of a single-digit expanded result (e.g. 1/25 -> 04/100), since it's meant
// to read as "easy," not as a dedicated connecting-zero drill like 50/100.
// Direct ranges throughout, no drawing-then-rejecting, per
// [[feedback_no_reroll_mechanics]].
function pickDecimalLevel2Numerator(denominator) {
  if (denominator === 50 || denominator === 100) {
    if (Math.random() < 0.5) return randInt(1, 9);
    return randInt(10, denominator - 1);
  }
  return randInt(1, denominator - 1);
}

// Same shown/typed mechanic as level 1, but the given denominator (2/5/10/
// 20/25/50/100) isn't already a power of ten -- it's always a clean
// multiple away from one, though (see decimalExpansionTarget()/
// buildDecimalAnswer() above).
function generateDecimalLevel2Exercise() {
  const forceZero = Math.random() < DECIMAL_L1_ZERO_CHANCE;
  const whole = forceZero ? 0 : randInt(1, DECIMAL_WHOLE_MAX);
  const denominator = randChoice(DECIMAL_L2_DENOMINATORS);
  const numerator = pickDecimalLevel2Numerator(denominator);

  return {
    whole, numerator, denominator,
    answer: buildDecimalAnswer(whole, numerator, denominator),
  };
}

// Level 3: DECIMAL_L3_HARD_CHANCE of draws use a harder denominator (4 or 8,
// equal chance -- see DECIMAL_L3_HARD_DENOMINATORS in config.js), needing a
// much bigger expansion factor (x25 or x125) than anything in level 2's own
// pool; no digit-count split on their numerator (both ranges are tiny --
// 1-3 for denominator 4, 1-7 for denominator 8 -- so there's nothing
// meaningful to split). The rest of the draws fall back to level 2's exact
// mechanic/pool (denominator *and* numerator-picking both reused, not
// reimplemented).
function generateDecimalLevel3Exercise() {
  const forceZero = Math.random() < DECIMAL_L1_ZERO_CHANCE;
  const whole = forceZero ? 0 : randInt(1, DECIMAL_WHOLE_MAX);
  const forceHard = Math.random() < DECIMAL_L3_HARD_CHANCE;
  const denominator = forceHard ? randChoice(DECIMAL_L3_HARD_DENOMINATORS) : randChoice(DECIMAL_L2_DENOMINATORS);
  const numerator = forceHard ? randInt(1, denominator - 1) : pickDecimalLevel2Numerator(denominator);

  return {
    whole, numerator, denominator,
    answer: buildDecimalAnswer(whole, numerator, denominator),
  };
}

// Level 7's own hard-tier numerator (see DECIMAL_L4_HARD_DENOMINATORS' own
// comment in config.js). For 4/8/200/250/500: capped at 20 (or the
// denominator's own max proper numerator, whichever is smaller), uniform
// across that range -- keeps the real multiplication to at most a 2-digit x
// 1-digit product, and naturally mixes reducible (4, 8, 12, 20) and
// non-reducible (7, 13, 17) numerators with no dedicated case for either.
// Denominator 40 is the one exception: even a capped-at-20 numerator times
// 40's own x25 expansion factor (e.g. 17x25=425) is still a genuinely hard
// multiplication -- harder than 200/250/500 hitting the same cap with their
// smaller x5/x4/x2 factors, and still showing up as "hard multiplication
// exercises" per the user's own report. So 40 alone reverts to units (1-9)
// or a whole ten (10/20/30), same as an earlier attempt at 200/250/500 that
// got dropped there for reducing too cleanly (70/200 = 7/20) -- the user
// explicitly accepted that same tradeoff here once multiplication size, not
// "does it look natural," became the deciding factor for this one
// denominator specifically.
function drawDecimalLevel4HardNumerator(denominator) {
  if (denominator === 40) {
    if (Math.random() < 0.5) return randInt(1, 9);
    return randInt(1, 3) * 10;
  }
  return randInt(1, Math.min(20, denominator - 1));
}

// Level 7: a three-tier weighted denominator draw, every number here given
// directly by the user rather than derived (see DECIMAL_L4_* constants'
// own comment in config.js for the full breakdown). Hard tier reuses
// drawDecimalLevel4HardNumerator() above; medium tier reuses level 2's own
// pickDecimalLevel2Numerator() (none of 2/5/20/25/50 trigger its 50/100
// digit-split branch); easy tier reuses level 1's own pool and digit-count
// rule (pickDecimalNumeratorDigitCount()) rather than level 2's, since
// 10/100/1000 are level 1's pool, not level 2's.
function generateDecimalLevel4Exercise() {
  const forceZero = Math.random() < DECIMAL_L1_ZERO_CHANCE;
  const whole = forceZero ? 0 : randInt(1, DECIMAL_WHOLE_MAX);
  const r = Math.random();
  let denominator, numerator;
  if (r < DECIMAL_L4_HARD_CHANCE) {
    denominator = randChoice(DECIMAL_L4_HARD_DENOMINATORS);
    numerator = drawDecimalLevel4HardNumerator(denominator);
  } else if (r < DECIMAL_L4_HARD_CHANCE + DECIMAL_L4_MEDIUM_CHANCE) {
    denominator = randChoice(DECIMAL_L4_MEDIUM_DENOMINATORS);
    numerator = pickDecimalLevel2Numerator(denominator);
  } else {
    denominator = randChoice(DECIMAL_DENOMINATORS);
    numerator = drawDecimalNumerator(pickDecimalNumeratorDigitCount(denominator));
  }

  return {
    whole, numerator, denominator,
    answer: buildDecimalAnswer(whole, numerator, denominator),
  };
}

// Level 3 (a number-line UI, promoted from its original "experimental level
// 4" slot once the UI itself was approved -- easier than the harder-
// denominator level, which shifted down to level 4 to make room, see
// generateDecimalLevel3Exercise()'s own comment below): a line from 0 to
// DECIMAL_NUMBER_LINE_RANGE_MAX, divided into tenths, and the student picks
// the point matching a shown mixed number whose denominator is 2, 5, or 10
// -- the only three denominators guaranteed to land exactly on a tenths
// tick (see DECIMAL_NUMBER_LINE_DENOMINATORS's own comment in config.js).
// Unlike level 3's earlier click-immediately-answers prototype, this reuses
// checkBtn/Enter as a genuine confirm step (per explicit user request,
// worried about mis-clicks) -- same "select first, confirm separately"
// shape as letters' reverse mode (selectLetterReverseOption()/
// checkLetterReverseAnswer(), exercise-letters.js), just picking a point on
// a line instead of a sound button. Its answer shape ("which tick index is
// correct") has nothing in common with currentDecimalAnswer's decimal-
// string shape, so it's kept fully separate from
// checkDecimalAnswer()/changeDecimalQuestion() -- see the
// isDecimalNumberLineLevel() branch in newExercise()/exercise-core.js.
// The decimals topic was split into two gameModes on 2026-09-10 --
// 'decimalstyped' (typed-answer levels) and 'decimalnumberline' (this one) --
// so every level in *this* gameMode is a number-line level; no index check
// needed at all. Before the split this same predicate had to single out
// two specific indices (then 3 and 5) out of one shared 7-level list --
// see [[project_decimals_topic_plan]] in memory for that history if a level
// number quoted anywhere else still assumes the old single-topic numbering.
function isDecimalNumberLineLevel() {
  return gameMode === 'decimalnumberline';
}

// The second (harder) of 'decimalnumberline's own two levels (see
// generateDecimalNumberLineHundredthsExercise() below) -- the same
// number-line mechanic as the first, just a denser 0-to-1 line marked off
// in hundredths instead of a 0-to-RANGE_MAX line marked off in tenths.
// Kept as its own predicate (rather than checking exerciseDifficultyIndex
// directly wherever this distinction matters) since only the *generation*
// differs between the two number-line levels -- render/select/check/wiring
// below are fully shared, parametrized by whatever `segments`/`rangeMax`
// the drawn exercise itself carries.
function isDecimalNumberLineHundredthsLevel() {
  return gameMode === 'decimalnumberline' && exerciseDifficultyIndex === 1;
}

// The second of 'decimalstyped's own five levels (see
// generateDecimalFractionNameExercise() further below): the Hebrew *name*
// of a fraction is shown, and the student writes both the fraction and the
// decimal -- an answer shape (three required boxes) that fits neither the
// plain decimal-string levels nor the number-line topic, so it gets its own
// dedicated render/check/reveal path, same reasoning as
// isDecimalNumberLineLevel() above.
function isDecimalFractionNameLevel() {
  return gameMode === 'decimalstyped' && exerciseDifficultyIndex === 1;
}

// Correct tick index (0..RANGE_MAX*10) and the index currently selected but
// not yet confirmed (null if none) -- exactly mirrors
// letterReverseSelected's role in exercise-letters.js, just as two separate
// primitives instead of one {option, btnEl} object, since there's no
// separate "option identity" here beyond the index itself (the tick element
// is always just ticksContainer.children[index]).
let decimalNumberLineCorrectIndex = null;
let decimalNumberLineSelectedIndex = null;

function generateDecimalNumberLineExercise() {
  const whole = randInt(0, DECIMAL_NUMBER_LINE_RANGE_MAX - 1); // fraction is always >0 and <1, so whole must stay below the line's own max
  const denominator = randChoice(DECIMAL_NUMBER_LINE_DENOMINATORS);
  const numerator = randInt(1, denominator - 1);
  // denominator always divides 10 evenly (2/5/10 only -- see this
  // constant's own comment in config.js), so this is always a whole tick
  // index, never a fractional one.
  const tickIndex = whole * 10 + numerator * (10 / denominator);
  return { whole, numerator, denominator, tickIndex, segments: DECIMAL_NUMBER_LINE_RANGE_MAX * 10, rangeMax: DECIMAL_NUMBER_LINE_RANGE_MAX };
}

// Level 5: same number-line mechanic, but a single 0-to-1 line marked off in
// hundredths instead -- so there's no whole part to show at all (always 0,
// omitted from display same as every other level's own w=0 case), and the
// denominator pool is level 4's own (see generateDecimalLevel3Exercise()'s
// comment below), minus 8. 8 doesn't divide 100 evenly (100/8 = 12.5), so a
// fraction like 3/8 would have no exact hundredths tick to land on --
// DECIMAL_NUMBER_LINE_HUNDREDTHS_HARD_DENOMINATOR (config.js) is just 4,
// still drawn at the same DECIMAL_L3_HARD_CHANCE. Every other denominator in
// that pool (2/5/10/20/25/50/100) divides 100 cleanly.
function generateDecimalNumberLineHundredthsExercise() {
  const forceHard = Math.random() < DECIMAL_L3_HARD_CHANCE;
  const denominator = forceHard ? DECIMAL_NUMBER_LINE_HUNDREDTHS_HARD_DENOMINATOR : randChoice(DECIMAL_L2_DENOMINATORS);
  const numerator = forceHard ? randInt(1, denominator - 1) : pickDecimalLevel2Numerator(denominator);
  const tickIndex = numerator * (100 / denominator);
  return { whole: 0, numerator, denominator, tickIndex, segments: 100, rangeMax: 1 };
}

// Picks which number-line generator this round draws from -- the only thing
// that actually differs between levels 3 and 5 (see isDecimalNumberLineLevel()
// above); everything downstream (render/select/check/keyboard wiring) reads
// the drawn exercise's own segments/rangeMax rather than assuming either one.
function generateDecimalNumberLineExerciseForLevel() {
  return isDecimalNumberLineHundredthsLevel() ? generateDecimalNumberLineHundredthsExercise() : generateDecimalNumberLineExercise();
}

// Builds the tick marks fresh each round -- plain <div>s, not buttons, since
// #numberLineHitArea (wired once below, not per-round) now owns all click/
// keyboard interaction; a tick's own DOM node is just something to paint a
// selected/correct/wrong state onto. Endpoints get a "0"/"<RANGE_MAX>"
// label; every interior tick's label stays blank -- labeling them would
// hand the answer away outright. Whole=0 omits the literal "0" from the
// *shown* side, same convention every other decimals level uses.
function renderDecimalNumberLineExercise(ex) {
  const shownHTML = ex.whole === 0
    ? fractionBlockHTML(ex.numerator, ex.denominator)
    : mixedNumberDisplayHTML(ex.whole, ex.numerator, ex.denominator);
  document.getElementById('questionText').innerHTML = shownHTML;

  const segments = ex.segments;
  const ticksContainer = document.getElementById('numberLineTicks');
  ticksContainer.innerHTML = '';
  ticksContainer.classList.remove('number-line-locked');
  // Dense lines (level 5's hundredths scale, 100 segments) get thin/faint
  // "hair" minor ticks (.number-line-tick-hair, style.css) instead of the
  // normal-weight ones a coarser scale (level 3's tenths, 30 segments)
  // uses -- at 100 segments, a normal 3px-wide mark every ~1% of the line's
  // width would blur together into a solid smear rather than read as
  // distinct ticks.
  const useHairMinor = segments > 50;
  for (let i = 0; i <= segments; i++) {
    // Every major landmark along the line (every 10th tick) gets its own
    // label and the tallest/boldest mark (.number-line-tick-whole,
    // style.css -- named for level 3's own whole-number landmarks, reused
    // as-is here for level 5's tenths landmarks instead, same "don't rename
    // a class just because a later level reuses it for something slightly
    // different" reasoning as this app's own tuning-constant convention);
    // the halfway point of each major interval (every 5th tick) gets a
    // medium mark -- a three-tier "major/half/minor" convention a real
    // ruler uses, giving the student landmarks to judge an in-between
    // point's position against instead of counting from 0 every time.
    const isMajor = i % 10 === 0;
    const isHalf = i % 10 === 5;
    const tick = document.createElement('div');
    let tickClass = 'number-line-tick';
    if (isMajor) tickClass += ' number-line-tick-whole';
    else if (isHalf) tickClass += ' number-line-tick-half';
    else if (useHairMinor) tickClass += ' number-line-tick-hair';
    tick.className = tickClass;
    tick.style.left = `${i * 100 / segments}%`;
    // i*rangeMax/segments is the tick's real value regardless of scale --
    // 10*3/30 -> 1 (level 3, whole numbers), 10*1/100 -> 0.1 (level 5,
    // tenths) -- rounded to guard against float noise on odd future scales.
    const label = isMajor ? String(Math.round((i * ex.rangeMax / segments) * 1000) / 1000) : '';
    tick.innerHTML = `<span class="number-line-tick-mark"></span><span class="number-line-tick-label">${label}</span>`;
    ticksContainer.appendChild(tick);
  }

  decimalNumberLineCorrectIndex = ex.tickIndex;
  decimalNumberLineSelectedIndex = null;
  document.getElementById('checkBtn').disabled = true; // nothing selected yet -- same "confirm needs a pick first" gate as letters reverse mode
  document.getElementById('numberLineHitArea').setAttribute('aria-valuemax', String(segments));
  document.getElementById('numberLineHitArea').focus();
}

// Selects tick `index` as the pending (unconfirmed) answer -- tapping a
// different tick before confirming just moves the selection, same as
// selectLetterReverseOption()'s own re-tap behavior. Refuses to select a
// tick already eliminated by a previous wrong confirm this round (a
// disabled letter-choice button already refuses clicks the same way; a
// plain <div> has no built-in disabled state, so this check stands in for
// that).
function selectDecimalNumberLineTick(index) {
  const ticksContainer = document.getElementById('numberLineTicks');
  const target = ticksContainer.children[index];
  if (!target || target.classList.contains('number-line-eliminated')) return;
  Array.from(ticksContainer.children).forEach(t => t.classList.remove('number-line-selected'));
  target.classList.add('number-line-selected');
  decimalNumberLineSelectedIndex = index;
  document.getElementById('checkBtn').disabled = false;
  document.getElementById('numberLineHitArea').setAttribute('aria-valuenow', String(index));
}

// Wired once at load (not per-round, same convention
// wireMixedNumberLevel3Answer3Nav() uses for its own dedicated element) --
// #numberLineHitArea is one full-line click/tap target spanning every tick
// rather than 31 individually tiny buttons, which at this level's tick
// density (up to 30 segments) would be too narrow and too close together to
// hit reliably on a touchscreen. A click computes the *nearest* tick from
// its x-position; ArrowLeft/ArrowRight nudge the selection by one tick for
// keyboard use (not RTL-flipped -- this line is explicitly direction:ltr
// regardless of the page's own RTL, same reasoning #compareChoices's own
// arrow-nav gets in wireChoiceArrowNav(), main.js); Enter confirms, same
// "Enter submits if something's actually selected" gate checkBtn.disabled
// already encodes elsewhere in this file.
function wireDecimalNumberLineInteraction() {
  const hitArea = document.getElementById('numberLineHitArea');
  const ticksContainer = document.getElementById('numberLineTicks');

  hitArea.addEventListener('click', (e) => {
    if (gameOver || ticksContainer.classList.contains('number-line-locked')) return;
    const segments = ticksContainer.children.length - 1;
    const rect = hitArea.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    selectDecimalNumberLineTick(Math.round(ratio * segments));
  });

  hitArea.addEventListener('keydown', (e) => {
    if (ticksContainer.classList.contains('number-line-locked')) return;
    if (e.key === 'Enter') {
      if (document.getElementById('checkBtn').disabled) return;
      e.preventDefault();
      checkAnswer();
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const segments = ticksContainer.children.length - 1;
    const current = decimalNumberLineSelectedIndex === null ? Math.round(segments / 2) : decimalNumberLineSelectedIndex;
    const next = current + (e.key === 'ArrowRight' ? 1 : -1);
    selectDecimalNumberLineTick(Math.max(0, Math.min(segments, next)));
  });
}
wireDecimalNumberLineInteraction();

// Dispatched from checkAnswer() (exercise-core.js) via its
// isDecimalNumberLineLevel() branch, same as checkDecimalAnswer() is for
// every other decimals level. Wrong pick: that tick is eliminated (stays
// disabled-looking, unselectable again this round) and the same question
// continues with the remaining ticks -- same wrong-eliminates-and-retry
// mechanic checkLetterReverseAnswer() uses for its own sound buttons.
function checkDecimalNumberLineAnswer() {
  if (gameOver) return;
  const checkBtn = document.getElementById('checkBtn');
  if (checkBtn.disabled) return; // nothing selected yet
  const ticksContainer = document.getElementById('numberLineTicks');
  if (ticksContainer.classList.contains('number-line-locked')) return;

  const selectedTick = ticksContainer.children[decimalNumberLineSelectedIndex];
  const isCorrect = decimalNumberLineSelectedIndex === decimalNumberLineCorrectIndex;
  ticksContainer.classList.add('number-line-locked');
  checkBtn.disabled = true;
  selectedTick.classList.remove('number-line-selected');

  if (isCorrect) {
    selectedTick.classList.add('number-line-correct');
    markCorrect(selectedTick);
    setTimeout(newExercise, 800);
  } else {
    // Both classes stay on this tick for the rest of the round -- unlike
    // the earlier grey-fade design, the red stays solid (see style.css):
    // user-reported the faded grey was hard to actually see against the
    // rest of the line. number-line-eliminated is now purely the "can't
    // reselect this one" logic flag (checked in selectDecimalNumberLineTick()
    // above); number-line-wrong supplies 100% of its visible look.
    selectedTick.classList.add('number-line-wrong', 'number-line-eliminated');
    markWrong(selectedTick);
    setTimeout(() => {
      ticksContainer.classList.remove('number-line-locked');
      decimalNumberLineSelectedIndex = null;
      document.getElementById('feedback').textContent = '';
      document.getElementById('feedback').className = 'feedback';
      document.getElementById('numberLineHitArea').focus();
    }, 800);
  }
}

// Dispatches across 'decimalstyped's own 5 levels -- generateDecimalLevel1/
// 2/3/4Exercise() names track the order each was *introduced* in, not
// current level position (same don't-rename-tuning-constants-on-a-renumber
// convention FRAC_ADD_L3_A_MIN established elsewhere): level 1 =
// generateDecimalLevel1Exercise, level 3 = generateDecimalLevel2Exercise,
// level 4 = generateDecimalLevel3Exercise (DECIMAL_L3_HARD_CHANCE of its
// draws use a harder denominator, 4 or 8; the rest fall back to level 3's
// exact mechanic), level 5 = generateDecimalLevel4Exercise (the three-tier
// draw). Level 2, the Hebrew fraction-name exercise, is *not* routed
// through here -- see isDecimalFractionNameLevel()'s own comment above for
// why its answer shape doesn't fit this dispatcher at all. The
// number-line mechanic lives entirely in the separate 'decimalnumberline'
// gameMode now, not in this list at all.
function generateDecimalExercise() {
  const level = exerciseDifficultyIndex + 1;
  if (level === 5) return generateDecimalLevel4Exercise();
  if (level === 4) return generateDecimalLevel3Exercise();
  if (level === 3) return generateDecimalLevel2Exercise();
  return generateDecimalLevel1Exercise();
}

// Renders the shown side as a "mixed number = [blank]" equation inside the
// shared #questionText/.frac-eq (same visual language as every other
// fraction-family topic), reusing fractionBlockHTML()/mixedNumberDisplayHTML()
// from exercise-core.js. A whole part of 0 shows the fraction alone, no
// literal "0" -- same convention addfractionsadvanced's showsMixedAddends
// ternary uses for its own w=0 addends.
function renderDecimalExercise(ex) {
  const questionText = document.getElementById('questionText');
  const input = document.getElementById('decimalTypedInput');
  const shownHTML = ex.whole === 0
    ? fractionBlockHTML(ex.numerator, ex.denominator)
    : mixedNumberDisplayHTML(ex.whole, ex.numerator, ex.denominator);
  questionText.innerHTML =
    '<span class="frac-eq">' +
      shownHTML +
      '<span class="frac-op">=</span>' +
      '<span id="decimalAnswerSlot"></span>' +
    '</span>';
  document.getElementById('decimalAnswerSlot').appendChild(input);
  input.value = '';
  input.disabled = false;
  input.classList.remove('answer-revealed');
  input.focus();
}

// Accepts both '.' and ',' as the decimal separator (per user request),
// normalized to '.'. Unlike normalizeGrammarTypedAnswer()'s exact-string
// match (exercise-grammar.js), this is compared numerically at the call
// site (Number(), not ===) -- the padded digit count baked into
// currentDecimalAnswer controls what gets *asked* (drilling the connecting
// zero for a given numerator/denominator), not what the student's own
// correct answer must look like. "0.6"/"0.60"/"0.600" are all the same
// number and all correct; only a genuinely different value (e.g. "0.3" for
// a correct "0.03") is wrong. Number() (not parseFloat()) so a malformed
// string like "0.6.7" comes back NaN -- never equal to anything, including
// itself -- instead of silently parsing as if the extra dot weren't there.
function normalizeDecimalTypedAnswer(s) {
  return s.trim().replace(/,/g, '.');
}

// Dispatched from checkAnswer() (exercise-core.js) via its
// gameMode === 'decimalstyped' branch -- same shared checkBtn/Enter-to-submit
// flow every typed-answer topic uses.
function checkDecimalAnswer() {
  if (gameOver) return;

  const input = document.getElementById('decimalTypedInput');
  const checkBtn = document.getElementById('checkBtn');
  const feedback = document.getElementById('feedback');
  if (checkBtn.disabled) return;

  if (input.value.trim() === '') {
    feedback.textContent = 'הכנס תשובה';
    feedback.className = 'feedback incorrect';
    return;
  }

  const isCorrect = Number(normalizeDecimalTypedAnswer(input.value)) === Number(currentDecimalAnswer);

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
// changeGrammarQuestion() is -- this topic's answer lives in
// #decimalTypedInput rather than the generic #answer/#answer2/#answer3
// changeQuestion() otherwise operates on.
function changeDecimalQuestion() {
  const swapBtn = document.getElementById('swapBtn');
  const checkBtn = document.getElementById('checkBtn');
  const input = document.getElementById('decimalTypedInput');
  if (swapBtn.disabled) return; // already mid-reveal

  chargeSwap(swapBtn);

  swapBtn.disabled = true;
  checkBtn.disabled = true;
  input.disabled = true;
  input.value = currentDecimalAnswer;
  input.classList.add('answer-revealed');

  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';

  swapTimeoutId = setTimeout(() => {
    checkBtn.disabled = false;
    input.disabled = false;
    swapBtn.disabled = false;
    newExercise(); // renderDecimalExercise() clears .answer-revealed for the new round
  }, SWAP_REVEAL_MS);
}
