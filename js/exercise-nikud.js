// ---------- Nikud exercise (letter+קמץ recognition, multiple choice) ----------
// Reuses checkLetterAnswer() from exercise-letters.js for answer-checking
// (renderNikudChoices() below wires its buttons to it directly) -- only
// generation and rendering are nikud-specific.

// Returns the letters that must never appear alongside `letter` as a
// {correct, distractor} pair, per NIKUD_CONFUSABLE_PAIRS (see config.js for
// why each pair sounds identical once pointed). See confusablesOf() in
// helpers.js -- abcConfusablesOf() in exercise-abc.js is the same lookup
// against a different pairs table.
function nikudConfusablesOf(letter) {
  return confusablesOf(letter, NIKUD_CONFUSABLE_PAIRS);
}

function generateNikudExercise() {
  // Level 1: fixed 4-letter pool, always all 4 as options, always in the
  // same order -- see NIKUD_LEVEL1_LETTERS in config.js for why (pool size
  // == options shown, so there's nothing to exclude or shuffle).
  if (exerciseDifficultyIndex === 0) {
    return { correct: randChoice(NIKUD_LEVEL1_LETTERS), options: NIKUD_LEVEL1_LETTERS };
  }

  // Levels 2-3: same random-5-of-pool mechanic as level 4, just drawn from a
  // smaller pool -- NIKUD_LEVEL2_LETTERS (א-ח) for level 2, NIKUD_LEVEL3_LETTERS
  // (א-ל) for level 3 -- instead of the full alphabet. See config.js for why
  // these pools were added as middle steps.
  let pool;
  if (exerciseDifficultyIndex === 1) pool = NIKUD_LEVEL2_LETTERS;
  else if (exerciseDifficultyIndex === 2) pool = NIKUD_LEVEL3_LETTERS;
  else pool = HEBREW_LETTERS;
  const correct = randChoice(pool);
  const excluded = new Set([correct, ...nikudConfusablesOf(correct)]);
  const distractorPool = pool.filter(l => !excluded.has(l));
  const distractors = pickDistinctRandom(distractorPool, 4);
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
//
// ת reuses ט's clip outright -- ת and ט are genuinely homophonous in Modern
// Hebrew (both a plain "t", unlike Biblical Hebrew where ת without dagesh
// was a distinct "th" sound), the same permanent-merger reasoning as ו
// reusing "soft ב" above. See NIKUD_CONFUSABLE_PAIRS in config.js, which
// already excludes ט/ת as mutual distractors for the same reason.
const NIKUD_AUDIO_OVERRIDE = { 'כ': 'ק', 'ת': 'ט' };

// פ: the site's own clip was unrecognizable as פ (reported as sounding like
// ה) -- replaced with a hard "pa" trimmed from a real-word recording of פס
// (see assets/nikud/CREDITS.txt). ט: the site's own clip was also reported
// as bad -- replaced with a clip trimmed from טל. ב/א/ג/ד: replaced not
// because they were unusable but as part of the broader project of
// replacing every soundsofnikud.com clip (unknown license) with a self-made
// one -- ב trimmed from בא, א from אהבה, ג from מגע, ד from ילדה (see
// assets/nikud/CREDITS.txt for why word-final syllables like מגע/ילדה are
// preferred going forward: the natural trailing silence at the end of a
// recording makes the back edge trivial to trim, unlike a word-initial
// syllable where the next consonant can bleed into the cut). All boosted
// with ffmpeg afterward (baked into the file -- see the abc "N" clip's
// CREDITS.txt entry for why a runtime Web Audio gain node was rejected in
// favor of this). Soft/undageshed ב and כ have also been self-recorded this
// way but aren't wired in yet -- level 1 stays hard-only for now, soft
// versions are earmarked for a future level.
// כ's own site clip is still in use *indirectly* via NIKUD_AUDIO_OVERRIDE
// above (borrowing ק's) -- a candidate replacement word (כף) was found and
// fetched but the recording wasn't clear enough either; postponed.
//
// ה, ז, ח: self-recorded directly by the user (not extracted from a longer
// word). ו: reuses the already-recorded "soft ב" clip outright (kamats/soft
// ב.wav copied to kamats/ו.wav) rather than an NIKUD_AUDIO_OVERRIDE-style
// runtime substitution, since ו and undageshed ב are genuinely homophonous
// in Modern Hebrew (both a plain "v"). י/ל/מ/נ/ס/צ: trimmed from real word
// recordings (בעיה/שאלה/נשמה/תמונה/מסה/ריצה) same as א/ב/ג/ד/ט/פ -- see
// assets/nikud/CREDITS.txt for all sources.
const NIKUD_CLIP_EXT = { 'א': 'wav', 'ב': 'wav', 'ג': 'wav', 'ד': 'wav', 'ה': 'wav', 'ו': 'wav', 'ז': 'wav', 'ח': 'wav', 'ט': 'wav', 'י': 'wav', 'ל': 'wav', 'מ': 'wav', 'נ': 'wav', 'ס': 'wav', 'ע': 'wav', 'פ': 'wav', 'צ': 'wav', 'ק': 'wav', 'ר': 'wav', 'ש': 'wav' };
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
  // Same "hear it, then pick" entry point as renderLetterChoices() -- see the
  // comment there.
  document.getElementById('letterSoundBtn').focus();
}
