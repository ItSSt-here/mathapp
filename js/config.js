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

// True when the page loaded with a valid ?topic=&difficulty= URL (a
// teacher-generated student link). Suppresses every path back to the
// topic/difficulty screens for the rest of the session (see parseUrlParams()
// and applyLinkModeUI() in main.js).
let arrivedViaLink = false;
const URL_PARAM_TOPIC = 'topic';
const URL_PARAM_DIFFICULTY = 'difficulty';
const VALID_TOPICS = ['multiplication', 'fractions', 'letters', 'abc']; // matches gameMode's own values, no translation table needed

// Letters exercise (recognition, for younger children): child taps a sound
// button to hear the letter's name (a recorded clip, see
// assets/letters/<letter>.mp3 and playLetterSound() in exercise.js) and picks
// it out of 5 options. Final-form letters (ך ם ן ף ץ) are left out for now --
// may be added later.
const HEBREW_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];

// ABC exercise: same listen-then-pick mechanic as HEBREW_LETTERS level 1
// (generateAbcExercise()/playAbcSound() in exercise.js reuse the shared
// renderLetterChoices()/checkLetterAnswer() rendering), for all 5 levels for
// now -- no reverse (see-letter/pick-sound) direction yet. Uppercase only.
const ABC_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

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

// Shown to the teacher on the difficulty-picker screen so they know what
// each level actually drills, in plain terms, per topic (see
// EXERCISE_LEVEL_CONFIGS above and pickFractionMode()/generateLevel5Exercise()
// in exercise.js for the logic each of these is describing). Indexed like
// EXERCISE_DIFFICULTIES; a topic with no entry here falls back to a
// placeholder in updateExerciseDifficultyLabel().
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
    'רואים אות, ולוחצים על כפתורי השמעה עד שמוצאים את זה שמשמיע את שמה, ואז לוחצים "בדוק" לאישור.',
    'רואים אות, ולוחצים על כפתורי השמעה עד שמוצאים את זה שמשמיע את שמה, ואז לוחצים "בדוק" לאישור.',
    'רואים אות, ולוחצים על כפתורי השמעה עד שמוצאים את זה שמשמיע את שמה, ואז לוחצים "בדוק" לאישור.',
  ],
  abc: [
    'שומעים את שם האות באנגלית (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות גדולות (A-Z).',
    'כמו ברמה 1, אבל כל 5 האותיות המוצגות הן אותיות קטנות (a-z).',
    'כמו ברמה 1, אבל כל אחת מ-5 האותיות המוצגות נבחרת באקראי כגדולה או קטנה.',
    'הפוך: מוצגת אות אחת (גדולה או קטנה, נבחר באקראי), ולוחצים על כפתורי השמעה עד שמוצאים את זה שמשמיע את שמה, ואז לוחצים "בדוק" לאישור.',
    'הפוך: מוצגת אות אחת (גדולה או קטנה, נבחר באקראי), ולוחצים על כפתורי השמעה עד שמוצאים את זה שמשמיע את שמה, ואז לוחצים "בדוק" לאישור.',
  ],
};

// ---------- State ----------
let num1, num2;
let currentAnswer; // correct value for the current exercise, any mode
let currentLetterAnswer = null; // correct letter (a single character) for the current letters-mode exercise
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
