// ---------- Config ----------
const CASTLE_MAX_HP = 300;
const SOLDIER_COST = 20;
const SOLDIER_HP = 30;
const STRIKE_MIN_DMG = 4;
const STRIKE_MAX_DMG = 6;
const STRIKE_INTERVAL_MS = 1000; // soldiers strike once per second once in range
const ENGAGE_RANGE = 3;          // % distance to start fighting
const TICK_MS = 250;
const CORRECT_REWARD = 10;
const WRONG_PENALTY = 5;
const SWAP_QUESTION_COST = 15;
const SWAP_REVEAL_MS = 2000;
const DEATH_FADE_MS = 5000;   // how long a fallen soldier lies there before disappearing
const FADE_DURATION_MS = 1000; // fades out over the last second before removal

// Soldier sprite animation: each pose has 10 frames (assets/sprites/knight/<color>/<pose>/1..10.png).
// Advanced on its own faster interval (see animTick() in combat.js) rather
// than the TICK_MS combat/movement loop -- some poses have a couple of
// near-identical "settle" frames, and at TICK_MS's pace those would stretch
// out long enough to look like the soldier sliding without moving its legs.
// 'dying' plays once and holds its last frame instead of looping.
const SPRITE_FRAME_COUNT = 10;
const ANIM_TICK_MS = 90;
const POSE_TO_SPRITE_FOLDER = { walking: 'walk', idle: 'idle', attacking: 'attack', dying: 'dead' };

// Castle art: 3 pre-drawn HP-based damage stages per side (assets/castle/<side>/).
const CASTLE_DAMAGE_STAGES = ['1-intact', '2-damaged', '3-severe'];

// Spawn points sit right at each side's own castle wall, so a new soldier
// appears to step out of its castle before marching off. Recalculated from
// the castle graphic's real measured width (see recalcSiegeThresholds in render.js).
let PLAYER_SPAWN_X = 96;
let COMPUTER_SPAWN_X = 4;

// Siege thresholds: soldiers stop and attack once they cross these. They
// are recalculated from the castle graphic's real measured width (see
// recalcSiegeThresholds in render.js) so a soldier always stops right at the
// castle's outer wall instead of marching on top of it and covering the artwork.
let PLAYER_SIEGE_X = 10;         // player soldier at/below this damages the enemy castle
let COMPUTER_SIEGE_X = 90;       // computer soldier at/above this damages the player castle

// The castle graphic is a fixed pixel width on every device, but the
// battlefield's pixel width varies a lot (a phone's is much narrower than a
// desktop's) -- so that same castle eats a much bigger *percentage* of a
// phone's track than a desktop's. If soldier speed were a fixed percentage
// per tick, that alone would make the march from spawn to siege noticeably
// faster on a phone than on a desktop: same settings, different game. So
// instead, recalcSiegeThresholds() derives SOLDIER_SPEED from the actual
// measured march distance so it always takes MARCH_SECONDS to cross,
// regardless of device. The value here is just a placeholder until the
// first recalc runs.
const MARCH_SECONDS = 42;
let SOLDIER_SPEED = 0.5; // % of track per tick

// How often the computer spawns a soldier, per difficulty (index matches
// DIFFICULTIES below): לאט מאוד, לאט, בינוני, מהר, מהר מאוד.
const DIFFICULTY_SPAWN_INTERVALS_MS = [40000, 30000, 20000, 15000, 10000];

// Every second of marching, a soldier has this chance to pause for that second
const HALT_CHANCE = 0.15;
const HALT_CHECK_INTERVAL_MS = 1000;

// Difficulty is picked on the home screen and carried over into every
// subsequent game (including instant "play again") until the player
// returns to the home screen and changes it. No gameplay effect yet.
const DIFFICULTIES = ['לאט מאוד', 'לאט', 'בינוני', 'מהר', 'מהר מאוד'];
const DEFAULT_DIFFICULTY_INDEX = 2;
let difficultyIndex = DEFAULT_DIFFICULTY_INDEX;

// Exercise difficulty picker: just numbers 1-5, no gameplay effect yet.
const EXERCISE_DIFFICULTIES = ['1', '2', '3', '4', '5'];
const DEFAULT_EXERCISE_DIFFICULTY_INDEX = 4;
let exerciseDifficultyIndex = DEFAULT_EXERCISE_DIFFICULTY_INDEX;

// Math type picked on the mode-select screen. 'multiplication' or 'fractions'.
// Fraction exercise generation isn't implemented yet -- newExercise() still
// falls back to multiplication questions in fractions mode for now.
let gameMode = 'multiplication';

// How far a teacher-generated link skips ahead, based on which URL params
// were present at load: 'mode' (no/invalid ?topic=, land on the topic
// picker as normal), 'difficulty' (?topic= only -- topic locked, land on
// the difficulty picker with ?difficulty= as its pre-filled starting
// position if given, still changeable), or 'speed' (?topic=&difficulty=&
// speed= all present -- topic+difficulty locked, land on the speed picker
// with ?speed= as its pre-filled starting position, still changeable).
// Suppresses the paths back to whichever screens got locked in for the
// rest of the session (see parseUrlParams() and applyLinkModeUI() in
// main.js). Each of the three pre-start screens has its own "העתק קישור"
// button building a link at that screen's own stage (buildShareLink()).
let arrivedStage = 'mode';
const URL_PARAM_TOPIC = 'topic';
const URL_PARAM_DIFFICULTY = 'difficulty';
const URL_PARAM_SPEED = 'speed';
const URL_PARAM_GROUP = 'group';
const VALID_TOPICS = ['multiplication', 'fractions', 'comparefractions', 'addfractions', 'subtractfractions', 'mixednumbers', 'addfractionsadvanced', 'letters', 'abc', 'nikud']; // matches gameMode's own values, no translation table needed
// The mode-select screen groups these 6 behind one "שברים" hub button
// (fractionsSubtopicOverlay in index.html) instead of listing them flat --
// see backToModeBtn's handler and parseUrlParams()/buildShareLink() in
// main.js for how this list is used to route "back" navigation and the
// hub's own ?group=fractions share link.
const FRACTIONS_GROUP_TOPICS = ['fractions', 'comparefractions', 'addfractions', 'subtractfractions', 'mixednumbers', 'addfractionsadvanced'];

// Letters exercise (recognition, for younger children): child taps a sound
// button to hear the letter's name (a recorded clip, see
// assets/letters/<letter>.mp3 and playLetterSound() in exercise-letters.js)
// and picks it out of 5 options. Final-form letters (ך ם ן ף ץ) are left out
// for now -- may be added later.
const HEBREW_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];

// ABC exercise: levels 1-3 reuse HEBREW_LETTERS level 1's listen-then-pick
// mechanic (varying upper/lowercase, see generateAbcExercise() in
// exercise-abc.js), levels 4-5 reuse the reverse (see-letter/pick-sound)
// direction. Sound is a recorded clip (assets/abc/<letter>.ogg, see
// playAbcSound() in exercise-abc.js), same as HEBREW_LETTERS.
const ABC_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// Capital I and lowercase l render as the same plain vertical stroke in the
// app's normal font (Arial) -- fixed for *listen* mode (where all 5 shapes
// show at once, side by side) by switching ABC's glyphs to Verdana, which
// keeps them visually distinct (see .abc-mode in style.css). But *reverse*
// mode (see abcVisualConfusablesOf() in exercise-abc.js) shows only one
// glyph at a time with nothing to compare it against, so even a
// distinct-looking "l" can't be told apart from "I" with confidence --
// never let one appear as a distractor sound when the other is the letter
// actually shown, same exclusion pattern as NIKUD_CONFUSABLE_PAIRS below
// (see confusablesOf() in helpers.js, shared by all three pair lists).
const ABC_VISUAL_CONFUSABLE_PAIRS = [['I', 'L']];

// M and N sound close enough that hearing one in isolation and picking the
// matching letter out of 5 shapes is an unfair guess (2026-07-30 user
// report) -- excluded from *listen* mode only (see abcAudioConfusablesOf()
// in exercise-abc.js). *Reverse* mode (letter shown, tap through candidate
// sounds to find the match) deliberately keeps them as possible distractors
// -- there the child can play every option and compare, which is the point
// of that mode, per explicit user call.
const ABC_AUDIO_CONFUSABLE_PAIRS = [['M', 'N']];

// Nikud exercise: child hears a letter pronounced with a niqud vowel mark
// (currently only קמץ -- recorded clips, see assets/nikud/kamats/<letter>.mp3
// and assets/nikud/CREDITS.txt) and picks the matching letter (shown with the
// same niqud mark), same mechanic/UI as HEBREW_LETTERS level 1 (see
// generateNikudExercise()/renderNikudChoices() in exercise-nikud.js). At the
// moment every difficulty level uses this same קמץ-only mechanic; more niqud
// types may be added later. Level 3 uses the full HEBREW_LETTERS pool (5
// options); level 2 uses the smaller NIKUD_LEVEL2_LETTERS pool (also 5
// options); level 1 is eligible as the target (including כ -- see
// NIKUD_AUDIO_OVERRIDE in exercise-nikud.js for how its sound is sourced,
// since it has no unambiguous recording of its own).

// Level 1's fixed, easier letter set (2026-07-30, user reported the full
// 22-letter level was too hard) -- exactly the 4 self-made-clip letters
// available at the time (see NIKUD_CLIP_EXT in exercise-nikud.js). Options
// are always all 4 of these, always in this fixed order (no shuffling) --
// with pool size == options shown, there's nothing to randomly exclude or
// permute, which also makes the UI predictable for a struggling learner.
const NIKUD_LEVEL1_LETTERS = ['א', 'ב', 'ג', 'ד'];

// Level 2's letter pool (2026-07-30, once the old full-alphabet level 2 --
// now shifted to level 3 -- turned out to be too big a jump from level 1's
// fixed 4). The first 8 base letters in alphabet order, א through ח --
// unlike level 1, this pool is bigger than the 5 options shown, so
// generateNikudExercise() picks 5 at random from it each time (same random-
// pick mechanic as level 3, just from this smaller pool) rather than
// showing all 8. None of NIKUD_CONFUSABLE_PAIRS falls within א-ח, so the
// same exclusion logic that level 3 uses is safe to reuse unchanged here.
const NIKUD_LEVEL2_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];

// Letter pairs that sound identical in Modern Hebrew once pointed -- never
// let one appear as a distractor when the other is the correct/played
// letter (see nikudConfusablesOf() in exercise-nikud.js). ק/כ sound identical
// (and כ's audio is literally ק's clip, see NIKUD_AUDIO_OVERRIDE); כ written
// without a dagesh reads like ח; ט/ת both sound "t" (and ת's audio is
// literally ט's clip, same override mechanism as כ/ק). א/ע: originally left
// unpaired on the theory that these recordings pronounce them distinctly
// enough to be worth testing (2026-07-23) -- reversed once actual self-made
// א.wav/ע.wav clips (2026-08) turned out hard to tell apart by ear in
// practice, so excluded like the others now.
const NIKUD_CONFUSABLE_PAIRS = [['ק', 'כ'], ['ח', 'כ'], ['ט', 'ת'], ['א', 'ע']];

// Letters whose glyph has a descender (a stroke dropping below the line,
// e.g. ק's leg) that collides with the niqud mark stacked underneath at the
// normal spacing -- see .nikud-descender-letter in style.css for the extra
// clearance added just for these.
const NIKUD_DESCENDER_LETTERS = ['ק'];

// Maps each base letter to soundsofnikud.com's transliterated filename stem
// (only needed at fetch time, kept here for reference/reuse if more niqud
// types are fetched later -- playNikudSound() itself just uses the Hebrew
// letter as the local filename, matching assets/letters/'s convention).
const NIKUD_LETTER_TRANSLIT = {
  'א': 'aleph', 'ב': 'bet', 'ג': 'gimel', 'ד': 'dalet', 'ה': 'he', 'ו': 'vav',
  'ז': 'zayin', 'ח': 'het', 'ט': 'tet', 'י': 'yod', 'כ': 'kaf', 'ל': 'lamed',
  'מ': 'mem', 'נ': 'nun', 'ס': 'samekh', 'ע': 'ayin', 'פ': 'pe', 'צ': 'tsadi',
  'ק': 'qof', 'ר': 'resh', 'ש': 'shin', 'ת': 'tav',
};

// Combining קמץ mark (U+05B8), rendered as its own enlarged element (see
// renderNikudChoices() in exercise-nikud.js) rather than relying on the font to
// combine+size it with the base letter -- combining-mark rendering doesn't
// give independent control over the mark's size, and it needs to read
// clearly on its own, more so once more niqud types are added alongside it.
const NIKUD_KAMATS_MARK = 'ָ';

// Combining דגש mark (U+05BC). ב/כ/פ are shown with a דגש in nikud-mode
// pictures because the exercise currently only plays/tests their *hard*
// sound (ba/ka/pa) -- without a דגש, standard Hebrew reading rules say these
// three read as their soft sound (va/kha/fa) instead, so the plain letter
// alone would misrepresent what's actually being heard.
const NIKUD_DAGESH_MARK = 'ּ';
const NIKUD_DAGESH_LETTERS = ['ב', 'כ', 'פ'];

// Fraction exercise: "complete the missing numerator" for a reduced fraction
// c/a, shown as its unreduced equivalent (b*c)/(b*a). a is the target
// (already-reduced) denominator; b is an inflation factor kept small when a
// is already large so b*a doesn't get unwieldy.
const FRACTION_TARGET_DEN_MIN = 2;
const FRACTION_TARGET_DEN_MAX = 9;
const FRACTION_TARGET_DEN_SPLIT = 4; // a in [2,4] vs [5,9] picks a different b range
const FRACTION_FACTOR_LOW_MIN = 2;
const FRACTION_FACTOR_LOW_MAX = 9;
const FRACTION_FACTOR_HIGH_MIN = 2;
const FRACTION_FACTOR_HIGH_MAX = 5;

// Level 4: this fraction of exercises are a full independent reduction with
// both the numerator and denominator blank; the rest fall back to level 3's
// format (one blank, direction + missing component both randomized).
const FRACTION_LEVEL4_FULL_REDUCTION_CHANCE = 0.8;

// Level 5's second inflation factor (b2) starts at 1 (unlike b, which starts
// at 2) -- b2=1 shows the reduced fraction c/a itself, naturally folding in
// level 3-style exercises as a subset without any special-casing.
const FRACTION_B2_MIN = 1;

// Fraction-addition exercise ("חיבור שברים"): p/n + q/n = [?]/n. n is drawn
// from a wide range since this topic comes after "שברים", where the student
// has already met many denominators. p and q are each >=1 with p+q<n (so the
// result is always a proper fraction) and gcd(p+q,n)=1 (so the result is
// always already reduced -- no simplification step at level 1). See
// generateFractionAdditionExercise() in exercise-addfractions.js.
const FRAC_ADD_DEN_MIN = 3;
const FRAC_ADD_DEN_MAX = 20;

// חיבור שברים מתקדם, level 1 (see generateFractionAdditionAdvancedLevel1Exercise()
// in exercise-addfractionsadvanced.js): p/n + q/n, same same-denominator
// mechanic as addfractions level 1, but both addends can be large enough
// that the sum reaches/exceeds n -- the answer is a mixed number (whole +
// remainder over the fixed denominator n) instead of a single blank
// numerator. Own denominator range (separate from FRAC_ADD_DEN_MIN/MAX) so
// it can be tuned independently, same convention subtractfractions used for
// its own FRAC_SUB_DEN_MIN/MAX.
const ADD_FRAC_ADV_L1_DEN_MIN = 3;
const ADD_FRAC_ADV_L1_DEN_MAX = 20;
// Fraction of exercises where the sum overflows past n (w=1) vs stays
// proper (w=0). Sum is always p+q with p,q<n, so it's always <2n -- w is
// only ever 0 or 1, no separate whole-number cap constant needed here
// (unlike MIXED_NUM_WHOLE_MAX).
const ADD_FRAC_ADV_L1_OVERFLOW_CHANCE = 0.80;

// Level 2 (see generateFractionAdditionAdvancedLevel2Exercise() in
// exercise-addfractionsadvanced.js): same p/n + q/n mechanic and the same
// ADD_FRAC_ADV_L1_DEN_MIN/MAX and ADD_FRAC_ADV_L1_OVERFLOW_CHANCE as level 1
// (reused, not a separate L2 range/chance -- same convention mixed-numbers
// level 3 uses reusing MIXED_NUM_DEN_MIN/MAX and MIXED_NUM_L1_ZERO_CHANCE),
// but this fraction of exercises forces gcd(r,n)>1 so the remainder needs
// reducing -- same relationship every other topic's own "level N+1 adds
// reduction" step has to its predecessor.
const ADD_FRAC_ADV_L2_REDUCTION_CHANCE = 0.70;

// Level 2 (see generateFractionAdditionLevel2Exercise() in
// exercise-addfractions.js): this fraction of exercises forces gcd(p+q, n) > 1
// so the sum needs reducing (both numerator and denominator blanked, same
// full-reduction UI as the "fractions" topic); the rest fall back to level 1's
// already-reduced mechanic.
const FRAC_ADD_L2_REDUCTION_CHANCE = 0.7;

// Level 3 (see generateFractionAdditionLevel3Exercise() in
// exercise-addfractions.js): p/a + q/(b*a) -- the second denominator is
// always a multiple of the first. a/b ranges mirror the compare-fractions
// topic's level 3 (same "one denominator a multiple of the other" idea),
// which keeps the resulting denominator b*a from growing unwieldy.
const FRAC_ADD_L3_A_MIN = 2;
const FRAC_ADD_L3_A_MAX = 9;
const FRAC_ADD_L3_B_MIN = 2;
const FRAC_ADD_L3_B_MAX = 4;
const FRAC_ADD_L3_B1_CHANCE = 0.10; // b=1 folds this into level 1's same-denominator mechanic

// Level 4 (see generateFractionAdditionLevel4Exercise() in
// exercise-addfractions.js): same p/a + q/(b*a) setup as level 3, but this
// fraction of exercises forces gcd(p*b+q, b*a) > 1 so the sum needs reducing
// -- same relationship level 2 has to level 1.
const FRAC_ADD_L4_REDUCTION_CHANCE = 0.7;

// Mixed-numbers exercise ("מספרים מעורבים"). Level 1: shows an
// improper-looking fraction p/b and asks for the equivalent mixed number
// w  r/b (denominator b fixed/shown, never editable). MIXED_NUM_L1_ZERO_CHANCE
// of draws are the "already proper" sub-case (p<b, so w=0 -- the
// whole-number box is left blank rather than typed as "0"); the rest are
// genuinely improper (p>b, w>=1). Both sub-cases render through the exact
// same template (see mixedNumberAnswerBlockHTML() in exercise-core.js), so
// the student can't tell which case they're in from the UI alone -- see
// [[feedback_exercise_no_giveaway_design]] in memory. Level 2 is the reverse
// direction (given w  r/b, complete the improper fraction's numerator over
// the same fixed b) -- reuses the same MIXED_NUM_DEN_MIN/MAX and
// MIXED_NUM_WHOLE_MAX ranges rather than its own constants, since w>=1
// always there too (no zero-whole sub-case in this direction: w is a given,
// not something the student has to notice). See
// generateMixedNumberLevel1Exercise()/generateMixedNumberLevel2Exercise() in
// exercise-mixednumbers.js.
const MIXED_NUM_DEN_MIN = 3;
const MIXED_NUM_DEN_MAX = 12;
const MIXED_NUM_WHOLE_MAX = 5;      // caps w in all three levels
const MIXED_NUM_L1_ZERO_CHANCE = 0.10;

// Level 3 (see generateMixedNumberLevel3Exercise() in
// exercise-mixednumbers.js): this fraction of exercises forces gcd(r,b)>1
// so the remainder fraction needs reducing -- same relationship every other
// topic's own "level N+1 adds reduction" step has to its predecessor
// (addfractions/subtractfractions level 2, fractions level 4).
const MIXED_NUM_L3_REDUCTION_CHANCE = 0.70;

// Level 4 (see generateMixedNumberLevel4Exercise() in
// exercise-mixednumbers.js): same relationship level 2 has to level 4 that
// level 1 has to level 3 -- this fraction of exercises forces gcd(r,a)>1 on
// the *given* mixed number's fractional part, so the resulting improper
// fraction needs reducing too (same gcd(w*a+r,a)=gcd(r,a) identity level 3
// relies on, just applied in the mixed-to-improper direction).
const MIXED_NUM_L4_REDUCTION_CHANCE = 0.70;

// Fraction-subtraction exercise ("חיסור שברים", added 2026-08-05): p/n - q/n
// = [?]/n, same-denominator mechanic as addition's level 1. Own denominator
// range (separate constants from FRAC_ADD_DEN_MIN/MAX) so it can be tuned
// independently as more levels are added later. See
// generateFractionSubtractionLevel1Exercise() in exercise-subtractfractions.js.
const FRAC_SUB_DEN_MIN = 3;
const FRAC_SUB_DEN_MAX = 20;

// Level 2 (see generateFractionSubtractionLevel2Exercise() in
// exercise-subtractfractions.js): this fraction of exercises forces
// gcd(p-q, n) > 1 so the difference needs reducing -- same relationship
// addfractions level 2 has to level 1.
const FRAC_SUB_L2_REDUCTION_CHANCE = 0.7;

// Level 3 (see generateFractionSubtractionLevel3Exercise() in
// exercise-subtractfractions.js): X = m/a and Y = k/(b*a) -- one denominator
// a multiple of the other. Ranges mirror addfractions level 3's own
// constants (FRAC_ADD_L3_*), kept separate so this topic can be tuned
// independently.
const FRAC_SUB_L3_A_MIN = 2;
const FRAC_SUB_L3_A_MAX = 9;
const FRAC_SUB_L3_B_MIN = 2;
const FRAC_SUB_L3_B_MAX = 4;
const FRAC_SUB_L3_B1_CHANCE = 0.10; // b=1 folds this into levels 1-2's same-denominator mechanic

// Level 4 (see generateFractionSubtractionLevel4Exercise() in
// exercise-subtractfractions.js): same X=m/a, Y=k/(b*a) setup as level 3,
// but this fraction of exercises forces gcd(diff, b*a) > 1 so the result
// needs reducing -- same relationship level 2 has to level 1.
const FRAC_SUB_L4_REDUCTION_CHANCE = 0.7;

// Compare-fractions exercise ("השוואת שברים"): pick either two proper
// fractions sharing a denominator (p/n vs q/n, compare numerators directly)
// or two sharing a numerator (n/p vs n/q, compare denominators inverted --
// fewer/bigger slices wins). See generateCompareFractionsExercise() in
// exercise-compare.js. At the moment every difficulty level (1-5) uses this
// same level-1 mechanic; harder variants may be added later.
const COMPARE_FRAC_SAME_DEN_MIN = 3;  // denominator must be >=3 for 2 distinct proper numerators to exist
const COMPARE_FRAC_SAME_DEN_MAX = 10;
const COMPARE_FRAC_SAME_NUM_MIN = 1;
const COMPARE_FRAC_SAME_NUM_MAX = 8;
const COMPARE_FRAC_DEN_SPREAD = 9; // denominators drawn from [num+1, num+SPREAD]

// Level 2's "complement to whole" sub-case (see generateCompareFractionsComplementExercise()
// in exercise-compare.js): fixed at 1 for now -- a randomized distance-from-whole
// made the trick too hard to spot, per user feedback.
const COMPARE_FRAC_COMPLEMENT_D = 1;

// Level 3's "one denominator is a multiple of the other" case (see
// generateCompareFractionsLevel3Exercise() in exercise-compare.js): q/a vs
// (b*q +/- n)/(b*a) -- the second denominator is always a multiple of the
// first, so the trick is expanding q/a to the common denominator (b*q)/(b*a)
// and then just comparing numerators. 10% of exercises use n=0, making the
// two fractions exactly equal -- the first case '=' is a real answer.
const COMPARE_FRAC_L3_A_MIN = 2;
const COMPARE_FRAC_L3_A_MAX = 9;
const COMPARE_FRAC_L3_B_MIN = 2;
const COMPARE_FRAC_L3_B_MAX = 4;
const COMPARE_FRAC_L3_N_MAX = 3; // nonzero offset magnitude drawn from [1, N_MAX]
const COMPARE_FRAC_L3_EQUAL_CHANCE = 0.10;

// Level 4: identical comparison to level 3 -- only the *display* of the
// left fraction changes, inflated by a random factor m (same b/b2
// mechanism the "fractions" topic's reduction exercises use) so the
// student has to recognize/reduce it first. m*q, m*a never change which
// fraction is bigger, so the correct answer is untouched.
const COMPARE_FRAC_L4_M_MIN = 2;
const COMPARE_FRAC_L4_M_MAX = 5;

// The only two comparison answers implemented through level 2 -- kept as a
// list (rather than two hardcoded buttons) so a same-value '=' sub-case
// could be added later just by extending it. Level 3 is that sub-case:
// COMPARE_OPTIONS_WITH_EQUAL is shown instead from level 3 onward (see
// newExercise() in exercise-core.js).
const COMPARE_OPTIONS = ['<', '>'];
const COMPARE_OPTIONS_WITH_EQUAL = ['<', '=', '>'];

const LEVEL1_NUMS = [0, 1, 10];
const LEVEL2_NUMS = [2, 3, 5];
const LEVEL3_NUMS_FULL = [4, 6, 7, 8, 9];
const NON_LEVEL1_NUMS = [2, 3, 4, 5, 6, 7, 8, 9];

// Per exercise-difficulty-level overrides of the tier thresholds (r < tier1
// is the "easy" 0/1/10 tier, r < tier2 is the "2/3/5" tier, the rest is the
// hardest tier drawn from hardPool). Index matches EXERCISE_DIFFICULTIES;
// levels not listed here fall back to the defaults just below.
const DEFAULT_TIER1_THRESHOLD = 0.10;
const DEFAULT_TIER2_THRESHOLD = 0.30;
const DEFAULT_HARD_POOL = LEVEL3_NUMS_FULL;

const EXERCISE_LEVEL_CONFIGS = {
  0: { tier1Threshold: 0.30, tier2Threshold: 1.00 },                           // level 1: hard tier never happens
  1: { tier1Threshold: 0.30, tier2Threshold: 0.80, hardPool: [4, 6] },         // level 2
  2: { tier1Threshold: 0.20, tier2Threshold: 0.50, hardPool: [4, 6, 9] },      // level 3
  3: { hardPool: [4, 6, 7, 9] },                                              // level 4: no 8
};

function getExerciseLevelConfig() {
  const override = EXERCISE_LEVEL_CONFIGS[exerciseDifficultyIndex] || {};
  return {
    tier1Threshold: override.tier1Threshold ?? DEFAULT_TIER1_THRESHOLD,
    tier2Threshold: override.tier2Threshold ?? DEFAULT_TIER2_THRESHOLD,
    hardPool: override.hardPool ?? DEFAULT_HARD_POOL,
  };
}

// How many difficulty levels are actually implemented per topic. Several
// topics' generate*Exercise() functions don't branch on every level 1-5 --
// e.g. letters only changes behavior once (listen vs. reverse mode; levels
// 2-5 were all identical reverse mode), nikud doesn't look at the level at
// all yet. Rather than let the picker offer levels that silently produce the
// exact same exercise as a lower one, it's capped here to what's real (see
// getExerciseLevelCount(), used by changeExerciseDifficulty() and
// updateExerciseDifficultyLabel() in main.js instead of a flat 5). Bump a
// topic's count up the day a genuinely new level is implemented for it --
// pair it with a new EXERCISE_LEVEL_DESCRIPTIONS entry below and nothing
// else needs to change. nikud is at 3 now: level 1 is a fixed 4-letter pool
// (NIKUD_LEVEL1_LETTERS), level 2 is a random-5-of-8 pool (NIKUD_LEVEL2_LETTERS,
// added 2026-07-30 as a middle step), level 3 is the original full-alphabet
// mechanic (bumped from level 2 the same day).
const EXERCISE_TOPIC_LEVEL_COUNTS = {
  multiplication: 5,
  fractions: 5,
  comparefractions: 4, // level 5 was identical to level 4
  addfractions: 4,
  subtractfractions: 4,
  mixednumbers: 4,
  addfractionsadvanced: 4,
  letters: 2,          // levels 2-5 were identical to each other
  abc: 4,               // level 5 was identical to level 4
  nikud: 3,
};

function getExerciseLevelCount() {
  return EXERCISE_TOPIC_LEVEL_COUNTS[gameMode] || EXERCISE_DIFFICULTIES.length;
}

// Shown to the teacher on the difficulty-picker screen so they know what
// each level actually drills, in plain terms, per topic (see
// EXERCISE_LEVEL_CONFIGS above and pickFractionMode()/generateLevel5Exercise()
// in exercise-fractions.js for the logic each of these is describing). Indexed like
// EXERCISE_DIFFICULTIES, trimmed to each topic's EXERCISE_TOPIC_LEVEL_COUNTS;
// a topic with no entry here falls back to a placeholder in
// updateExerciseDifficultyLabel().
const EXERCISE_LEVEL_DESCRIPTIONS = {
  multiplication: [
    'תרגילים קלים: ב-70% מהמקרים אחד המספרים הוא 2, 3 או 5 (והשני בין 2 ל-9); ב-30% הנותרים אחד המספרים הוא 0, 1 או 10. אין תרגילים ששני המספרים בהם קשים יחד (כמו 7×8).',
    'ב-50% מהמקרים אחד המספרים הוא 2, 3 או 5 (והשני בין 2 ל-9); ב-30% אחד המספרים הוא 0, 1 או 10; ב-20% הנותרים שני המספרים הם 4 או 6 (למשל 4×6, 6×6).',
    'ב-50% מהמקרים שני המספרים נבחרים מתוך 4, 6, 9. ב-20% אחד המספרים הוא 0, 1 או 10, וב-30% אחד המספרים הוא 2, 3 או 5.',
    'ברוב המקרים (70%) שני המספרים נבחרים מתוך 4, 6, 7, 9 (בלי 8). ב-10% אחד המספרים הוא 0, 1 או 10, וב-20% אחד המספרים הוא 2, 3 או 5.',
    'הרמה הקשה ביותר: ב-70% מהמקרים שני המספרים נבחרים מתוך 4, 6, 7, 8, 9 (כולל צירופים כמו 7×8, 8×9, 9×9). ב-10% אחד המספרים הוא 0, 1 או 10, וב-20% אחד המספרים הוא 2, 3 או 5.',
  ],
  fractions: [
    'מוצג שבר לא מצומצם, ויש למלא את המונה של הצורה המצומצמת שלו (המכנה שלה כבר נתון). לדוגמה: 6/8 = ?/4.',
    'בכל תרגיל מוצג שבר אחד ויש למלא את המונה של השבר המקביל לו — לפעמים צריך לצמצם שבר לא מצומצם, ולפעמים להרחיב שבר מצומצם. המכנה תמיד נתון.',
    'בכל תרגיל מוצג שבר אחד ויש להשלים חלק אחד בשבר המקביל לו — הצמצום או ההרחבה, וכן האם החלק החסר הוא המונה או המכנה, נבחרים באקראי.',
    'ברוב המקרים (80%) מוצג שבר לא מצומצם ויש לצמצם אותו עד הסוף בעצמו: גם המונה וגם המכנה של הצורה המצומצמת חסרים. ב-20% הנותרים יש להשלים רק חלק אחד (מונה או מכנה) של שבר מקביל, כשהצמצום או ההרחבה נבחרים באקראי.',
    'לעולם לא מוצג השבר המצומצם עצמו: מוצגים שני שברים שווי-ערך אך לא מצומצמים, עם מכנים שונים. שבר אחד מלא והשני חסר בו מונה או מכנה, כך שיש להשוות בין שני השברים הלא מצומצמים ישירות.',
  ],
  letters: [
    'שומעים את שם האות (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות.',
    'רואים אות, ולוחצים על כפתורי השמעה עד שמוצאים את זה שמשמיע את שמה, ואז לוחצים "בדוק" לאישור.',
  ],
  abc: [
    'שומעים את שם האות באנגלית (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות גדולות (A-Z).',
    'כמו ברמה 1, אבל כל 5 האותיות המוצגות הן אותיות קטנות (a-z).',
    'כמו ברמה 1, אבל כל אחת מ-5 האותיות המוצגות נבחרת באקראי כגדולה או קטנה.',
    'הפוך: מוצגת אות אחת (גדולה או קטנה, נבחר באקראי), ולוחצים על כפתורי השמעה עד שמוצאים את זה שמשמיע את שמה, ואז לוחצים "בדוק" לאישור.',
  ],
  nikud: [
    'שומעים אחת מ-4 האותיות א, ב, ג, ד עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 4 כפתורים קבועים, תמיד באותו סדר.',
    'שומעים אות עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות עם קמץ, מתוך 8 האותיות הראשונות (א-ח).',
    'שומעים אות עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות עם קמץ, מתוך כל האלף-בית.',
  ],
  addfractions: [
    'מוצגים שני שברים עם אותו מכנה (בין 3 ל-20) שסכומם קטן מהמכנה -- יש להשלים את מונה תוצאת החיבור. לדוגמה: 2/7 + 3/7 = ?/7. התוצאה תמיד שבר תקין ומצומצם מראש.',
    'כמו ברמה 1, אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של תוצאת החיבור בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים סכום המונים והמכנה כבר זרים זה לזה, כך שאין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
    'מוצגים שני שברים שבהם המכנה של השבר השני הוא כפולה של מכנה השבר הראשון (למשל 2/3 ו-5/9, כי 9=3×3) -- יש להרחיב את השבר הראשון למכנה המשותף (2/3=6/9) ואז לחבר את המונים. ב-10% מהמקרים המכנים זהים מלכתחילה (בדיוק כמו ברמה 1). התוצאה תמיד שבר תקין ומצומצם מראש.',
    'כמו ברמה 3, אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של תוצאת החיבור בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
  ],
  subtractfractions: [
    'מוצגים שני שברים עם אותו מכנה (בין 3 ל-20), כשהמונה הראשון גדול מהשני -- יש להשלים את מונה תוצאת החיסור. לדוגמה: 5/7 - 2/7 = ?/7. התוצאה תמיד שבר תקין ומצומצם מראש.',
    'כמו ברמה 1, אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של תוצאת החיסור בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
    'מוצגים שני שברים שבהם המכנה של אחד מהם הוא כפולה של מכנה השני (למשל 2/3 ו-5/9, כי 9=3×3) -- באקראי, לפעמים השבר הראשון גדול יותר ולפעמים השני, כך שהחיסור פועל בשני הכיוונים. יש להרחיב את השבר בעל המכנה הקטן יותר למכנה המשותף ואז לחסר את המונים. ב-10% מהמקרים המכנים זהים מלכתחילה (בדיוק כמו ברמות 1-2). התוצאה תמיד שבר תקין (חיובי) ומצומצם מראש.',
    'כמו ברמה 3, אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של תוצאת החיסור בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
  ],
  mixednumbers: [
    'מוצג שבר (p/b) שברוב המקרים (כ-90%) הוא שבר לא-תקין, ויש להמיר אותו למספר מעורב: למלא את מספר השלמים ואת מונה השארית מעל b (המכנה b נשאר קבוע ולא ניתן לשינוי). בכ-10% מהמקרים השבר בעצם תקין (החלק השלם הוא 0) -- במקרה כזה יש להשאיר את תיבת השלמים ריקה ולעבור לתיבת השארית בעזרת חץ ימינה, ולא להזין 0. אין צמצום ברמה זו.',
    'הכיוון ההפוך: מוצג מספר מעורב (מספר שלם ולידו שבר תקין ומצומצם, למשל 3 וגם 2/5) ויש להמיר אותו לשבר לא-תקין: להשלים רק את המונה מעל b (המכנה b נשאר קבוע). החלק השלם תמיד לפחות 1 (לעולם לא 0), ותיבת התשובה חייבת תמיד להיות מלאה.',
    'כמו ברמה 1 (כולל האפשרות להשאיר את תיבת החלק השלם ריקה כשהוא 0), אבל בנוסף -- בכל תרגיל, בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של שארית השבר בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
    'כמו ברמה 2 (מספר מעורב נתון, ויש להמיר לשבר לא-תקין), אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של השבר הלא-תקין בצורתו המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
  ],
  addfractionsadvanced: [
    'מוצגים שני שברים עם אותו מכנה (בין 3 ל-20), אבל הפעם סכומם עשוי לעבור את השלם -- יש להשלים את התוצאה כמספר מעורב: מספר שלם (0 או 1 בלבד) ולידו מונה השארית מעל המכנה הנתון. ב-80% מהמקרים הסכום עובר את השלם (החלק השלם הוא 1); ב-20% הנותרים הוא נשאר שבר תקין (החלק השלם הוא 0, ותיבת השלמים נשארת ריקה). שארית השבר תמיד כבר מצומצמת -- אין צמצום ברמה זו.',
    'כמו ברמה 1, אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של שארית השבר בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
    'כמו ברמה 1 (בלי צמצום), אבל הפעם שני האיברים המחוברים הם בעצמם מספרים מעורבים (חלק שלם ולידו שבר), לא רק שברים פשוטים -- יש לחבר גם את החלקים השלמים וגם את חלקי השבר, ולזכור להעביר 1 לחלק השלם אם סכום השברים חורג מהמכנה. בכ-10% מהמקרים כל אחד מהאיברים בנפרד הוא בעצם שבר פשוט ללא חלק שלם (מוצג בלי "0").',
    'כמו ברמה 3 (שני מספרים מעורבים), אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של שארית השבר בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
  ],
  comparefractions: [
    'מוצגים שני שברים -- לפעמים עם אותו מכנה, לפעמים עם אותו מונה (באקראי) -- ויש לבחור > או < כדי לקבוע איזה מהם גדול יותר.',
    'ב-50% מהמקרים -- כמו ברמה 1. ב-50% הנותרים, מוצגים שני שברים שלשניהם חסר בדיוק חלק אחד (1) כדי להגיע לשלם (למשל 3/4 ו-5/6) עם מכנים שונים -- יש להשוות באמצעות טריק ההשלמה לשלם: להשוות בין המשלימים (כמו כלל "אותו מונה" מרמה 1) ואז להפוך את המסקנה.',
    'מוצגים שני שברים שבהם המכנה של השבר השני הוא כפולה של מכנה השבר הראשון (למשל 2/3 מול 7/9, כי 9=3×3) -- יש להרחיב את השבר הראשון למכנה המשותף (2/3=6/9) ואז להשוות בין המונים. ב-90% מהמקרים התשובה היא > או <, וב-10% הנותרים שני השברים שווים בדיוק -- ומכאן ואילך = היא תשובה אפשרית.',
    'כמו ברמה 3, אבל השבר הראשון מוצג כשבר לא מצומצם (למשל 4/6 במקום 2/3) -- יש לזהות/לצמצם אותו קודם (או לשים לב לגורם המשותף) ואז להשוות כמו ברמה 3. ב-90% מהמקרים התשובה היא > או <, וב-10% הנותרים שני השברים שווים בדיוק.',
  ],
};

// ---------- State ----------
let num1, num2;
let currentAnswer; // correct value for the current exercise, any mode
let currentLetterAnswer = null; // correct letter (a single character) for the current letters-mode exercise
let currentCompareAnswer = null; // correct '<'/'>' for the current comparefractions-mode exercise
let playerMoney = 0;
let playerCastleHP = CASTLE_MAX_HP;
let computerCastleHP = CASTLE_MAX_HP;
let soldiers = [];
let soldierId = 0;
let gameOver = false;
let intervalId = null;
let animIntervalId = null;
let enemySpawnTimer = 0;
let swapTimeoutId = null;
let battleElapsedMs = 0;

// Per-game session counters shown in .top-stats-row during play and again
// (bigger, centered) on the win/lose overlay -- see markCorrect()/markWrong()/
// changeQuestion() in exercise-core.js, which increment these, and
// updateStatsCountersDisplay() in the same file, which renders them.
let correctCount = 0;
let wrongCount = 0;
let swapCount = 0;
