// ---------- Config ----------
const CASTLE_MAX_HP = 300;
const SOLDIER_COST = 20;
const SOLDIER_HP = 30;
const STRIKE_MIN_DMG = 4;
const STRIKE_MAX_DMG = 6;
const STRIKE_INTERVAL_MS = 1000; // soldiers strike once per second once in range
// All distances below are in board units (see WORLD_W/WORLD_H further down).
// Melee only starts at real contact distance -- aggro (AGGRO_RANGE) is what
// makes a soldier walk up to an enemy in the first place.
const ENGAGE_RANGE = 4;
const TICK_MS = 250;
const CORRECT_REWARD = 10;
const WRONG_PENALTY = 5;
const SWAP_QUESTION_COST = 15;
// Coins are capped so a win's leftover balance can double as a bounded
// "נקודות" score (see markCorrect() and endGame()) -- without a cap, a
// student who avoids spending could inflate the number indefinitely, which
// would make it useless for comparing rounds in the parent-facing log.
const MAX_COINS = 200; // v2: raised from 100 since gold mines make each correct answer worth more
const SWAP_REVEAL_MS = 2000;
const DEATH_FADE_MS = 5000;   // how long a fallen soldier's skull lies there before disappearing

// Weak-pool: replay-recently-missed-questions mechanic (toggle: the
// weakPoolCheckbox on exDifficultyOverlay, see index.html). A pool entry
// waits its countdown's worth of other questions before it's eligible to
// resurface (see tickWeakPool() in exercise-core.js), then has a
// WEAK_POOL_DRAW_CHANCE chance of being picked instead of a fresh question
// each time newExercise() runs. Capped at WEAK_POOL_MAX_SIZE, oldest entry
// evicted first, so one rough stretch can't flood every future question slot.
// Two different starting countdowns (see recordWeakPoolRecovery()/
// recordWeakPoolSwap() in exercise-core.js): actually recovering the right
// answer after a mistake means it's less urgent than giving up on it
// entirely via a swap, so it waits longer before coming back.
const WEAK_POOL_RECOVERED_COUNTDOWN = 5;
const WEAK_POOL_SWAP_COUNTDOWN = 2;
const WEAK_POOL_DRAW_CHANCE = 0.5;
const WEAK_POOL_MAX_SIZE = 4;

// Soldier art: Pixel Frog's "Tiny Swords" (older CC0 release -- see
// assets/sprites/warrior/CREDITS.txt), used as CSS sprite sheets: one image
// per sheet, and render.js shows one frame of it at a time via
// background-position. Each animation is a list of [column, row] frames.
// Advanced on its own faster interval (see animTick() in combat.js) rather
// than the TICK_MS combat/movement loop, so animation stays smooth.
const ANIM_TICK_MS = 90; // the art is drawn for ~10fps
const SOLDIER_SHEETS = {
  // 6 cols x 8 rows of 192px frames, per team color (blue = player, red = enemy)
  warrior: { cols: 6, rows: 8 },
  // 7 cols x 2 rows of 128px frames: skull pops out (0-9), then sinks away (10-13)
  dead: { cols: 7, rows: 2 }
};
function sheetRows(rows, cols) {
  const frames = [];
  for (const row of rows) for (let col = 0; col < cols; col++) frames.push([col, row]);
  return frames;
}
const SOLDIER_ANIMS = {
  idle:        { sheet: 'warrior', frames: sheetRows([0], 6) },
  walking:     { sheet: 'warrior', frames: sheetRows([1], 6) },
  // Two swings per animation (12 frames ~= STRIKE_INTERVAL_MS), in whichever
  // of 3 directions the target is (s.attackDir, combat.js). Sideways swings
  // face right and get mirrored for left like every other pose.
  attack_side: { sheet: 'warrior', frames: sheetRows([2, 3], 6) },
  attack_down: { sheet: 'warrior', frames: sheetRows([4, 5], 6) },
  attack_up:   { sheet: 'warrior', frames: sheetRows([6, 7], 6) },
  dying:       { sheet: 'dead', frames: sheetRows([0, 1], 7) }
};
// The skull holds on this frame (lying on the ground) until the last
// DEATH_SINK_MS of DEATH_FADE_MS, then plays its sinking-away frames.
const DEATH_HOLD_FRAME = 9;
const DEATH_SINK_MS = 500;

// Castle art: Tiny Swords' tower per team color (assets/buildings, see its
// CREDITS.txt). Damage is shown with animated fires on top (render.js):
// one fire at or below CASTLE_FIRE_1_PCT of max HP, three at or below
// CASTLE_FIRE_2_PCT, and the ruined tower image once HP reaches 0.
const CASTLE_FIRE_1_PCT = 50;
const CASTLE_FIRE_2_PCT = 15;

// ---------- The board (see [[project_2d_board_v2]] in memory) ----------
// A flat "3/4 view" board like Warcraft 2 / StarCraft: no camera tilt, the
// angled look comes from the art itself. Positions live in fixed board
// units, WORLD_W x WORLD_H, and the board element gets that same aspect
// ratio (placeBoard() in render.js), so one unit is the same on-screen
// length along both axes --
// straight-line distances (aggro, melee, castle reach) and diagonal movement
// mean the same thing in every direction. Castles and soldiers are sized in
// % of the board too, so the whole picture just scales with the window and
// nothing has to be measured at runtime. A soldier's (x, y) is where its
// FEET stand, so sorting by y gives correct front/back overlap for free.
// The board is wider than the screen: VIEW_W units are visible at a time
// The board is bigger than the screen in both directions: a VIEW_W x
// VIEW_H window of it is visible at a time, and the rest is reached by
// scrolling (scrollbars, the number-pad arrows, or the minimap -- see
// commands.js). placeBoard() (render.js) sizes the board and its window from
// these, so they're the only source. The castles and the main road run
// through the vertical middle; the open areas above and below it are room
// for side objectives (e.g. gold mines, see [[project_v2_roadmap]]).
const WORLD_W = 200;
const WORLD_H = 130;
const VIEW_W = 100;
const VIEW_H = 40;
const Y_MOVE_MIN = 7;   // keeps a soldier's head on the board at the top edge
const Y_MOVE_MAX = WORLD_H - 1;

// Castle base-center points (the bottom middle of each castle's artwork,
// where it meets the ground). Each side's "castle" is Tiny Swords' round
// tower, drawn 1.3x the soldiers' pixel scale so it reads as the main
// building (128px art -> 9.5 units wide, see .castle-graphic in style.css).
// Its ground footprint -- used for "is a soldier close enough to besiege
// it" -- is a box CASTLE_HALF_W to each side of that point and CASTLE_DEPTH
// deep going up the board from it; a soldier within CASTLE_REACH of that box
// can besiege (castleDistance() in combat.js).
const PLAYER_CASTLE_POS = { x: WORLD_W - 8, y: 65 };
const COMPUTER_CASTLE_POS = { x: 8, y: 65 };
const CASTLE_HALF_W = 4.2;
const CASTLE_DEPTH = 5;
const CASTLE_REACH = 3;

// Player soldiers appear in a small cluster right at their own tower's gate
// (always a little below the tower's base line, so they're drawn in front
// of it rather than hidden behind it) and just stand there until given an
// order (see commands.js). RALLY_JITTER is the random spread around that
// point, in board units.
const PLAYER_RALLY = { x: WORLD_W - 10, y: 68.5 };
const RALLY_JITTER = { x: 3, y: 2.5 };

// A soldier walks toward any enemy this close (even mid-order -- it resumes
// the order once that fight is over), and soldiers standing closer than
// SEPARATION_DIST get nudged apart so a group never collapses into one sprite.
const AGGRO_RANGE = 14;
const SEPARATION_DIST = 2.5;

// Enemy AI (see tickEnemyAI() in combat.js):
// - Guards: exist from the first second, stand at fixed posts in front of
//   the enemy castle, chase intruders but never beyond GUARD_LEASH from
//   their post, and are never replaced once killed.
// - Raiders: new enemy soldiers (DIFFICULTY_SPAWN_INTERVALS_MS below) gather
//   at ENEMY_RALLY until a randomly sized squad (ENEMY_SQUAD_MIN-MAX) is
//   complete, then all march on the player's castle together.
const ENEMY_GUARD_POSTS = [{ x: 22, y: 53 }, { x: 24, y: 64 }, { x: 22, y: 74 }];
const GUARD_LEASH = 22;
const ENEMY_RALLY = { x: 14, y: 74 };

// Scenery (placeBoard() in render.js): purely decorative, soldiers walk
// past it. Fixed positions so the map looks the same every game; kept clear
// of the castles. x/y is where each item touches the ground. Trees line the
// top and bottom edges and dot the open areas above/below the road; small
// bushes/rocks/mushrooms/a pumpkin are scattered around the road.
// `art` keys into SCENERY_ART: image, width in board units, and how far down
// its own image the ground point sits (measured from the art).
const SCENERY_ART = {
  tree:     { src: 'assets/terrain/tree.png', w: 11, baseY: 0.88, sheetCols: 4, sheetRows: 3 },
  mushroom: { src: 'assets/terrain/deco-01.png', w: 3.67, baseY: 0.66 },
  rock1:    { src: 'assets/terrain/deco-04.png', w: 3.67, baseY: 0.56 },
  rock2:    { src: 'assets/terrain/deco-05.png', w: 3.67, baseY: 0.56 },
  bush1:    { src: 'assets/terrain/deco-07.png', w: 3.67, baseY: 0.66 },
  bush2:    { src: 'assets/terrain/deco-08.png', w: 3.67, baseY: 0.66 },
  bush3:    { src: 'assets/terrain/deco-09.png', w: 3.67, baseY: 0.66 },
  pumpkin:  { src: 'assets/terrain/deco-13.png', w: 3.67, baseY: 0.84 }
};
const SCENERY = [
  // top edge
  { art: 'tree', x: 6, y: 7 }, { art: 'tree', x: 21, y: 5 }, { art: 'tree', x: 36, y: 7 },
  { art: 'tree', x: 49, y: 5 }, { art: 'tree', x: 63, y: 8 }, { art: 'tree', x: 80, y: 6 },
  { art: 'tree', x: 114, y: 5 }, { art: 'tree', x: 131, y: 7 },
  { art: 'tree', x: 148, y: 6 }, { art: 'tree', x: 163, y: 8 }, { art: 'tree', x: 179, y: 5 },
  { art: 'tree', x: 194, y: 7 },
  // bottom edge
  { art: 'tree', x: 10, y: 131 }, { art: 'tree', x: 27, y: 132 }, { art: 'tree', x: 42, y: 131 },
  { art: 'tree', x: 78, y: 132 }, { art: 'tree', x: 88, y: 131 }, { art: 'tree', x: 105, y: 131 },
  { art: 'tree', x: 122, y: 132 }, { art: 'tree', x: 150, y: 132 }, { art: 'tree', x: 159, y: 131 },
  { art: 'tree', x: 176, y: 132 }, { art: 'tree', x: 192, y: 131 },
  // small groves in the open areas above and below the road
  { art: 'tree', x: 58, y: 30 }, { art: 'tree', x: 64, y: 33 }, { art: 'tree', x: 140, y: 29 },
  { art: 'tree', x: 36, y: 100 }, { art: 'tree', x: 170, y: 100 }, { art: 'tree', x: 100, y: 98 },
  { art: 'bush2', x: 74, y: 27 }, { art: 'rock1', x: 30, y: 30 }, { art: 'mushroom', x: 170, y: 32 },
  { art: 'bush3', x: 100, y: 110 }, { art: 'rock2', x: 30, y: 112 }, { art: 'pumpkin', x: 168, y: 112 },
  // around the road
  { art: 'bush1', x: 55, y: 57 }, { art: 'bush3', x: 88, y: 70 }, { art: 'rock1', x: 120, y: 54 },
  { art: 'rock2', x: 146, y: 72 }, { art: 'mushroom', x: 72, y: 63 }, { art: 'pumpkin', x: 101, y: 61 },
  { art: 'bush2', x: 132, y: 65 }, { art: 'mushroom', x: 44, y: 68 }, { art: 'rock2', x: 60, y: 74 },
  { art: 'bush1', x: 156, y: 56 }
];
const ENEMY_SQUAD_MIN = 1;
const ENEMY_SQUAD_MAX = 3;

// ---------- Gold mines (tickMines() in combat.js, renderMines() in render.js) ----------
// Off the main road on purpose (see [[project_v2_roadmap]]): taking one is a
// detour that splits your army, not a free bonus on the way to the enemy.
// One contested mine top-middle, equally far from both castles; one at the
// bottom a bit closer to each side. All start neutral.
// A side captures a mine by having soldiers up on its plateau and none of
// the other side's, for MINE_CAPTURE_MS in a row (a ring fills up); it then
// stays that side's until the other side captures it back.
// Each mine the player holds adds MINE_BONUS coins to every correct answer
// (markCorrect(), exercise-core.js) -- so mines make every exercise worth
// more. Each mine the enemy holds makes its new soldiers come out
// ENEMY_MINE_SPAWN_SPEEDUP faster, so leaving the mines to it has a price.
// Every mine sits on its own raised plateau (PLATEAUS below): cliffs all
// around, one ramp in, on the far side from the road -- so going for a mine
// is a real detour. Only soldiers up on the plateau count for capturing it.
// Every mine starts with guards (purple warriors, their own neutral
// side) at `guardPosts`: nobody can capture a mine while any of its guards
// still stands, so taking one means building an army first. They attack
// anyone who comes up onto their plateau within MINE_GUARD_LEASH of their
// post, never go down the ramp, and are never replaced once killed.
// `hold` is where an enemy squad that took the mine stands guard.
const MINE_SITES = [
  { x: 100, y: 33, plateau: 0,
    guardPosts: [{ x: 93, y: 22 }, { x: 107, y: 22 }, { x: 100, y: 19 }], hold: { x: 100, y: 25 } },
  { x: 62, y: 101, plateau: 1,
    guardPosts: [{ x: 56, y: 108 }, { x: 68, y: 108 }], hold: { x: 62, y: 109 } },
  { x: 138, y: 101, plateau: 2,
    guardPosts: [{ x: 132, y: 108 }, { x: 144, y: 108 }], hold: { x: 138, y: 109 } }
];
const MINE_GUARD_LEASH = 14;

// ---------- Raised plateaus (terrain grid + pathfinding: terrain.js) ----------
// Ellipses in board units (center cx,cy, radii rx,ry) -- round on purpose:
// a rectangle's corners were where soldiers used to get stuck. The outer
// CLIFF_W-thick ring of each one is cliff (impassable), except for the
// ramp: a gap RAMP_W units wide, centered at rampX, through the cliff on
// its `rampSide` (top or bottom). The top plateau keeps a
// walkable corridor between itself and the top edge (and the bottom ones
// between themselves and the bottom edge) so you can walk around to the ramp.
// Step 1 of the feature: mechanic with placeholder visuals (see
// [[project_v2_roadmap]]); real cliff/stairs art comes later.
const CLIFF_W = 2;
const RAMP_W = 6;
const PLATEAUS = [
  { cx: 100, cy: 26, rx: 19, ry: 12, rampSide: 'top', rampX: 100 },
  { cx: 62, cy: 104, rx: 19, ry: 12, rampSide: 'bottom', rampX: 62 },
  { cx: 138, cy: 104, rx: 19, ry: 12, rampSide: 'bottom', rampX: 138 }
];
// A mine the player holds lets them see around it, like their castle does
// (playerSightCircles(), render.js). Any other mine shows its owner, flag
// and capture ring only while the player currently sees it -- under fog it
// just looks like a plain mine (renderMines()).
const MINE_SIGHT = 18;
const MINE_CAPTURE_MS = 3000;
const MINE_BONUS = 3;
const ENEMY_MINE_SPAWN_SPEEDUP = 0.2;  // spawn interval x (1 - 0.2 per enemy mine)
// When an enemy squad is ready, the chance it goes to take a mine it doesn't
// own (then stays there guarding it) instead of attacking the player's castle.
const ENEMY_MINE_RAID_CHANCE = 0.5;

// Fog of war (renderFog() in render.js): the board is dimmed everywhere
// except within sight of the player's castle and living soldiers, and enemy
// soldiers are only drawn inside that sight. Nothing is remembered -- a spot
// goes back into fog as soon as nobody sees it anymore. Sight is well past
// AGGRO_RANGE so an enemy is always seen before soldiers run at it.
const SOLDIER_SIGHT = 20;
const CASTLE_SIGHT = 26;
const FOG_COLOR = 'rgba(12, 18, 32, 0.62)';

// Most living soldiers either side may have on the board at once (corpses
// don't count). Stops "buy 1000 soldiers" play; the enemy's guards count
// toward its cap, and it simply skips a spawn while at the cap.
const MAX_SOLDIERS_PER_SIDE = 20;

// Board units per tick. 0.8 crosses the whole 200-unit board in about a minute.
const SOLDIER_SPEED = 0.8;

// How often the computer spawns a soldier, per difficulty (index matches
// DIFFICULTIES below): לימוד - ללא אויב, לאט מאוד, לאט, בינוני, מהר, מהר מאוד.
// The slowest tier is `null` rather than a huge number -- it's not "very
// infrequent spawning", it's a distinct practice mode with no enemy at all
// (see isStudyMode() in helpers.js, checked by tick()'s spawn step below and
// by buySoldier()/updateCoinsDisplay() to also block buying soldiers, since a
// side with no enemy to fight has no need for its own army either).
const DIFFICULTY_SPAWN_INTERVALS_MS = [null, 40000, 30000, 20000, 15000, 10000];

// Difficulty is picked on the home screen and carried over into every
// subsequent game (including instant "play again") until the player
// returns to the home screen and changes it. No gameplay effect yet.
const DIFFICULTIES = ['לימוד - ללא אויב', 'לאט מאוד', 'לאט', 'בינוני', 'מהר', 'מהר מאוד'];
const DEFAULT_DIFFICULTY_INDEX = 3;
let difficultyIndex = DEFAULT_DIFFICULTY_INDEX;

// Exercise difficulty picker: just numbers 1-5, no gameplay effect on its
// own (each topic's own getExerciseLevelCount() caps how far a given topic
// can actually go -- this array only supplies the label text, so it just
// needs to be at least as long as the topic with the most levels). Grew to
// 7 briefly while decimals was a single topic with that many levels;
// shrunk back to 5 once decimals split into 'decimalstyped' (5 levels) and
// 'decimalnumberline' (2) on 2026-09-10. Grew to 6 on 2026-09-15 when
// 'fractions' gained a new level 1 (expand-by-a-given-multiplier) ahead of
// its previous 5 levels -- fractions is once again the max across every
// topic.
const EXERCISE_DIFFICULTIES = ['1', '2', '3', '4', '5', '6'];
const DEFAULT_EXERCISE_DIFFICULTY_INDEX = 4;
let exerciseDifficultyIndex = DEFAULT_EXERCISE_DIFFICULTY_INDEX;

// Math type picked on the mode-select screen. 'multiplication' or 'fractions'.
// Fraction exercise generation isn't implemented yet -- newExercise() still
// falls back to multiplication questions in fractions mode for now.
let gameMode = 'multiplication';

// How far a teacher-generated link skips ahead, based on which URL params
// were present at load: 'mode' (no/invalid ?topic= and no recognized
// ?group=, land on the topic picker as normal), 'subtopic' (?group=<name>
// instead of a real ?topic=, e.g. a link built from the fractions or
// decimals hub screen before a specific sub-topic was chosen -- land on
// that group's own subtopic overlay, see TOPIC_GROUPS in main.js),
// 'difficulty' (?topic= only -- topic locked, land on the difficulty
// picker with ?difficulty= as its pre-filled starting position if given,
// still changeable), or 'speed' (?topic=&difficulty=&speed= all present --
// topic+difficulty locked, land on the speed picker with ?speed= as its
// pre-filled starting position, still changeable). Suppresses the paths
// back to whichever screens got locked in for the rest of the session (see
// parseUrlParams() and applyLinkModeUI() in main.js). Each of the four
// pre-start screens has its own "העתק קישור" button building a link at
// that screen's own stage (buildShareLink()).
let arrivedStage = 'mode';
// Which topic group (a key into TOPIC_GROUPS, main.js) a 'subtopic'-stage
// arrival resolved to -- null otherwise. Set by parseUrlParams()'s own
// resolveGroupFallback() helper, read by showInitialOverlay() (which
// overlay to show) and applyLinkModeUI() (which group's own "back to full
// topic list" button to suppress).
let arrivedGroup = null;
const URL_PARAM_TOPIC = 'topic';
const URL_PARAM_DIFFICULTY = 'difficulty';
const URL_PARAM_SPEED = 'speed';
const URL_PARAM_GROUP = 'group';
// Carries the vocabulary word list itself (serializeVocabularyWordList()'s
// same "english;hebrew" per-line format, see exercise-vocabulary.js) --
// URLSearchParams handles the percent-encoding of ';'/newlines/Hebrew
// automatically on both ends, so no separate compression step is needed for
// a chapter-sized list (~150-200 words was confirmed comfortably within
// normal link-length limits, see [[project_vocabulary_topic_plan]]).
const URL_PARAM_WORDS = 'words';
// Carries the weak-pool checkbox's state (see WEAK_POOL_* above) --
// '1'/'0', defaulting to on (matching the checkbox's own default) when
// absent, same as an old link predating this feature. Set alongside
// URL_PARAM_DIFFICULTY (buildShareLink() in main.js) since it lives on the
// same exDifficultyOverlay screen.
const URL_PARAM_REVIEW = 'review';
const VALID_TOPICS = ['multiplication', 'fractions', 'comparefractions', 'addfractions', 'subtractfractions', 'mixednumbers', 'addfractionsadvanced', 'letters', 'abc', 'nikud', 'vocabulary', 'division', 'grammar', 'decimalstyped', 'decimalnumberline']; // matches gameMode's own values, no translation table needed
// The mode-select screen groups these 6 behind one "שברים" hub button
// (fractionsSubtopicOverlay in index.html) instead of listing them flat --
// see backToModeBtn's handler and parseUrlParams()/buildShareLink() in
// main.js for how this list is used to route "back" navigation and the
// hub's own ?group=fractions share link.
const FRACTIONS_GROUP_TOPICS = ['fractions', 'comparefractions', 'addfractions', 'subtractfractions', 'mixednumbers', 'addfractionsadvanced'];
// Same pattern, added 2026-09-10 when the single 'decimals' topic (which
// had grown to 7 levels mixing two genuinely different mechanics -- typed
// decimal answers and number-line clicks) was split behind its own
// "מספרים עשרוניים" hub button (decimalsSubtopicOverlay in index.html):
// 'decimalstyped' (5 levels, everything answered by typing -- including the
// Hebrew fraction-name level, which also has a typed decimal component)
// and 'decimalnumberline' (2 levels, the number-line click UI). See
// TOPIC_GROUPS in main.js, which both this and FRACTIONS_GROUP_TOPICS feed
// into for the now-generalized hub/back/share-link machinery.
const DECIMALS_GROUP_TOPICS = ['decimalstyped', 'decimalnumberline'];

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
// types may be added later. Level 5 uses the full HEBREW_LETTERS pool (5
// options); level 4 uses the NIKUD_LEVEL4_LETTERS pool (also 5 options);
// level 3 uses the medium NIKUD_LEVEL3_LETTERS pool (also 5 options); level 2
// uses the smaller NIKUD_LEVEL2_LETTERS pool (also 5 options); level 1 is
// eligible as the target (including כ -- see NIKUD_AUDIO_OVERRIDE in
// exercise-nikud.js for how its sound is sourced, since it has no
// unambiguous recording of its own).

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

// Level 3's letter pool (2026-08-23, added as a middle step between level 2's
// 8 letters and level 4's full 22 -- same random-5-of-pool mechanic, just a
// bigger pool). The first 12 base letters in alphabet order, א through ל.
// Unlike level 2's pool, this one does contain a NIKUD_CONFUSABLE_PAIRS entry
// (ח/כ) -- no special-casing needed though, since nikudConfusablesOf()'s
// exclusion in generateNikudExercise() already applies regardless of pool.
const NIKUD_LEVEL3_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל'];

// Level 4's letter pool (2026-08-24, added as a further middle step between
// level 3's 12 letters and the full-alphabet level, which shifted from level
// 4 to level 5 to make room). The first 16 base letters in alphabet order, א
// through ע. Same random-5-of-pool mechanic as levels 2-3, and same "no
// special-casing needed" note as level 3 -- ק/כ and ט/ת confusable pairs fall
// outside this pool, but א/ע (added to NIKUD_CONFUSABLE_PAIRS 2026-08) does
// fall inside it, and nikudConfusablesOf()'s exclusion already applies
// regardless of pool.
const NIKUD_LEVEL4_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע'];

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

// Level 1 (see generateLevel1ExpandExercise() in exercise-fractions.js): the
// multiplier X is stated in the question itself (unlike every other level,
// where the student has to infer it), so this range is tuned independently
// of FRACTION_FACTOR_LOW/HIGH_MIN/MAX above -- X reuses the same
// FRACTION_TARGET_DEN_MIN/MAX range as the shown fraction's own denominator,
// but that's a coincidence of both being "any single digit from 2-9", not a
// shared concept.
const FRACTION_L1_EXPAND_MULT_MIN = 2;
const FRACTION_L1_EXPAND_MULT_MAX = 9;

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

// Level 4 (see generateFractionAdditionLevel4Exercise() in
// exercise-addfractions.js): p/a + q/(b*a) -- the second denominator is
// always a multiple of the first. a/b ranges mirror the compare-fractions
// topic's level 3 (same "one denominator a multiple of the other" idea),
// which keeps the resulting denominator b*a from growing unwieldy. Kept
// their original "L3" names (from before level 3 became the scaffold below)
// rather than renaming to "L4" -- same don't-rename-tuning-constants-on-a-
// renumber convention as ADD_FRAC_ADV_L2_REDUCTION_CHANCE, already reused
// across two levels. Level 3 (the new scaffold) also draws from this same
// a/b range, via the same generateMultipleDenomLevel3Exercise() call, just
// forcing b1Chance to 0 instead of reading FRAC_ADD_L3_B1_CHANCE -- the
// scaffold's whole point is practicing the expansion step, which the b=1
// fold-in has none of.
const FRAC_ADD_L3_A_MIN = 2;
const FRAC_ADD_L3_A_MAX = 9;
const FRAC_ADD_L3_B_MIN = 2;
const FRAC_ADD_L3_B_MAX = 4;
const FRAC_ADD_L3_B1_CHANCE = 0.10; // b=1 folds this into level 1's same-denominator mechanic

// Level 5 (see generateFractionAdditionLevel5Exercise() in
// exercise-addfractions.js): same p/a + q/(b*a) setup as level 4, but this
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
// a multiple of the other. Ranges mirror addfractions' own FRAC_ADD_L3_*
// constants (used by its level 4 now, after a scaffold was inserted ahead of
// it -- see config.js's own FRAC_ADD_L3_* comment), kept separate so this
// topic can be tuned independently.
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

// Decimals exercise ("מספרים עשרוניים"), level 1 (see
// generateDecimalLevel1Exercise() in exercise-decimals.js): a mixed number
// (whole + proper fraction) is shown -- denominator drawn with equal chance
// from DECIMAL_DENOMINATORS -- and the student types its decimal form
// freehand (e.g. "3.05"), both '.' and ',' accepted as the separator. The
// whole part is 0-DECIMAL_WHOLE_MAX, occasionally 0 (DECIMAL_L1_ZERO_CHANCE)
// -- shown as a plain fraction with no literal "0" whole part, same
// convention addfractionsadvanced's showsMixedAddends ternary uses for its
// own w=0 addends -- though the *typed* decimal answer still needs its own
// leading "0." there, same as real notation. The numerator's digit count is
// controlled per denominator (see pickDecimalNumeratorDigitCount()) so the
// student gets deliberate practice with the "connecting zero" trick (e.g.
// 3/100 = 0.03): denominator 10 always draws a single digit (the only
// option, since a proper, non-multiple-of-10 numerator under 10 is always
// 1-9); 100 splits 50/50 between one and two digits; 1000 splits 25/25/50
// across one/two/three digits. "Never a multiple of 10" is guaranteed by
// construction in drawDecimalNumerator() -- the numerator's last digit is
// always drawn from 1-9 -- rather than by drawing-then-rejecting.
const DECIMAL_DENOMINATORS = [10, 100, 1000];
const DECIMAL_WHOLE_MAX = 5;
// Also reused as-is by level 2 below (same whole-part range, same zero
// chance) -- kept its "L1" name rather than renaming on reuse, same
// convention FRAC_ADD_L3_A_MIN/etc. already established for a constant that
// outgrew the level it was named after.
const DECIMAL_L1_ZERO_CHANCE = 0.30;

// Level 2 (see generateDecimalLevel2Exercise() in exercise-decimals.js): same
// shown/typed mechanic as level 1, but drawn from a denominator that's easy
// to mentally expand to tenths or hundredths instead of already being one --
// 2/5/10 expand to tenths (multiply by 5/2/1), 20/25/50/100 expand to
// hundredths (multiply by 5/4/2/1), drawn with equal chance across all seven
// (25 added after level 2 shipped -- it's genuinely easy, same tier as
// 20/50, not the "harder" tier level 3 introduces below). The numerator is
// otherwise just drawn uniformly across its full proper range (1 to
// denominator-1) with no other restriction -- e.g. 10/20 = 0.50 is a
// perfectly legitimate draw here, unlike level 1's own numerator, which
// specifically excludes multiples of 10 (there is no such exclusion in level
// 2). The one exception: denominators 50/100 get a single-digit/two-digit
// split on the numerator, same as level 1's own denom-100 rule, so the
// student gets deliberate practice with the connecting zero after expansion
// (e.g. 1/50 -> expand x2 -> 02/100 -> 0.02). For denominator 50
// specifically this split is on the *pre-expansion* numerator, so a
// "single-digit" draw (1-9) can still expand to a two-digit result (x2 ->
// 2-18) -- acknowledged and accepted as fine, not worth a dedicated
// exclusion just for this one denominator. 25 deliberately does *not* get
// this split (uniform like 20, not like 50/100) -- a judgment call, since
// the user's own split rule named only 50/100 and 25 was added later as an
// "easy" denominator, not one worth a dedicated connecting-zero drill.
const DECIMAL_L2_DENOMINATORS = [2, 5, 10, 20, 25, 50, 100];

// Level 4 (see generateDecimalLevel3Exercise() in exercise-decimals.js --
// kept its original "L3" name/comment below despite shifting down to level
// 4 once the number-line level was promoted to level 3 ahead of it, same
// don't-rename-tuning-constants-on-a-renumber convention FRAC_ADD_L3_A_MIN
// already established elsewhere in this file): same mechanic as level 2,
// but DECIMAL_L3_HARD_CHANCE of draws use a harder denominator instead -- 4
// (expand x25 -> hundredths) or 8 (expand x125 -> thousandths), equal
// chance between the two. Both need a much bigger multiplier than anything
// in DECIMAL_L2_DENOMINATORS, and 8 additionally forces three decimal
// places -- genuinely harder, unlike 25 (see just above). The rest of the
// draws (1 - DECIMAL_L3_HARD_CHANCE) fall back to the exact same level-2
// mechanic/pool. 15 was considered and rejected outright (not just
// "harder" -- 15 = 3x5 never terminates as a decimal at all, since only
// denominators built purely from 2s and 5s divide evenly into a power of
// ten); 40 (=2^3x5, expand x25 -> thousandths) is mathematically valid but
// was skipped as redundant with 8 already covering that difficulty tier.
const DECIMAL_L3_HARD_DENOMINATORS = [4, 8];
const DECIMAL_L3_HARD_CHANCE = 0.40;

// Level 3 (see generateDecimalNumberLineExercise() in exercise-decimals.js):
// a number line from 0 to DECIMAL_NUMBER_LINE_RANGE_MAX, marked off in
// tenths, and the student picks the point matching a shown whole+fraction.
// The denominator must be one that lands exactly on a tenths mark -- only
// 2, 5, and 10 qualify (any other denominator this app draws elsewhere --
// 4, 8, 20, 25, 50, 100 -- would sometimes land *between* two tenths marks,
// with no tick to pick at all). Originally an experimental "level 4"
// covering just 0-to-1 with a click-immediately-answers mechanic; promoted
// to level 3 (bumping the harder-denominator level above to level 4) once
// the UI itself was approved, extended to this wider range, and switched to
// a genuine select-then-confirm mechanic (checkBtn/Enter) per explicit user
// request -- worried about a mis-click on a densely-packed line counting as
// a wrong answer immediately, with no chance to correct it first.
const DECIMAL_NUMBER_LINE_DENOMINATORS = [2, 5, 10];
const DECIMAL_NUMBER_LINE_RANGE_MAX = 3;

// Level 5 (see generateDecimalNumberLineHundredthsExercise() in
// exercise-decimals.js): same number-line mechanic as level 3, but a single
// 0-to-1 line marked off in hundredths (100 segments) instead -- no whole
// part at all, and the denominator pool is level 4's own
// (DECIMAL_L2_DENOMINATORS at DECIMAL_L3_HARD_CHANCE fallback, or a harder
// denominator the rest of the time), minus 8: 8 doesn't divide 100 evenly
// (100/8 = 12.5), so a fraction like 3/8 would have no exact hundredths
// tick to land on -- 4 is the only harder denominator kept, still drawn at
// the same DECIMAL_L3_HARD_CHANCE. At 100 segments the line needs to be
// drawn much wider than level 3's own 30-segment one to stay clickable at
// all -- see .number-line-wrap's own widened max-width in style.css, sized
// for a desktop screen; this level was explicitly agreed to not need to
// work on a phone.
const DECIMAL_NUMBER_LINE_HUNDREDTHS_HARD_DENOMINATOR = 4;

// Level 2 (see generateDecimalFractionNameExercise() in
// exercise-decimals.js, inserted between levels 1 and the former level 2 --
// every level from here on shifted down by one, see EXERCISE_TOPIC_LEVEL_COUNTS.decimals'
// own comment): the Hebrew *name* of a fraction is shown (e.g. "שלוש
// חמישיות"), and the student writes it both as a fraction (numerator +
// denominator) and as a decimal -- three required boxes checked together.
// Every round is one of two families, chosen by weighted draw:
// - "Special" named fractions (DECIMAL_FRACTION_NAME_SPECIAL_CHANCE, 30%):
//   denominator 2/4/5/8, equal chance -- these are the only denominators
//   below 10 with a short, irregular Hebrew fraction-name (חצי/רבע/חמישית/
//   שמינית) that also terminates as a decimal (excludes e.g. שליש/שישית/
//   שביעית -- 3/6/7 all fail the terminates-as-decimal test, same 2s-and-5s-
//   only rule used throughout this topic). Numerator uniform across its
//   full proper range (1 to denominator-1).
// - "Constant" named fractions (10/100/1000, i.e. עשיריות/מאיות/אלפיות):
//   tenths get the remaining 10%; hundredths and thousandths each get their
//   own DECIMAL_FRACTION_NAME_*_CHANCE (30% apiece). Digit-count split
//   deliberately different from every other level's own numerator rules in
//   this topic (see pickFractionNameDigitCount(), exercise-decimals.js) --
//   confirmed directly with the user: hundredths splits 50/50 single/double
//   digit (same as level 1's own denom-100 rule, coincidentally), but
//   thousandths splits evenly in *thirds* (single/double/triple), not
//   level 1's 25/25/50.
const DECIMAL_FRACTION_NAME_SPECIAL_DENOMINATORS = [2, 4, 5, 8];
const DECIMAL_FRACTION_NAME_SPECIAL_CHANCE = 0.30;
const DECIMAL_FRACTION_NAME_HUNDREDTHS_CHANCE = 0.30;
const DECIMAL_FRACTION_NAME_THOUSANDTHS_CHANCE = 0.30;
// The remaining 1 - (sum of the three above) = 10% always falls back to
// denominator 10 (עשיריות) -- no dedicated chance constant of its own, since
// it's just whatever probability mass is left over once the other three are
// spent.

// Level 7 (see generateDecimalLevel4Exercise() in exercise-decimals.js --
// "L4" because it's the fourth *typed*-mechanic generator this topic ever
// added, same "internal name tracks introduction order, not current level
// number" convention DECIMAL_L3_HARD_DENOMINATORS/etc. already established):
// a three-tier weighted denominator draw, entirely user-specified (every
// number below was given directly by the user, not derived) --
// DECIMAL_L4_HARD_CHANCE (70%) draws one of the six hardest denominators
// this topic has ever used (4/8, already level 5's own hard tier, plus 40/
// 200/250/500, new here); DECIMAL_L4_MEDIUM_CHANCE (20%) draws one of
// 2/5/20/25/50 (level 2's own pool minus 10/100, which move to the "really
// easy" tier below instead); the remaining 10% falls back to level 1's own
// 10/100/1000 pool and its own digit-count rule (pickDecimalNumeratorDigitCount()),
// not level 2's -- reused as-is rather than duplicated. Numerator
// construction (drawDecimalLevel4HardNumerator(), exercise-decimals.js),
// after three rounds of user-driven correction: 4/8/200/250/500 draw
// uniformly from 1 to min(20, denominator-1) -- keeps the real
// multiplication to at most a 2-digit x 1-digit product, mixing reducible
// (4, 8, 12, 20) and non-reducible (7, 13, 17) numerators with no dedicated
// case for either (for 4/8 the cap just reproduces their own already-tiny
// full range, 3 and 7). Denominator 40 is the one exception, reverted to
// units (1-9) or a whole ten (10/20/30): even a capped-at-20 numerator
// times 40's own x25 expansion factor (e.g. 17x25=425) was still showing up
// as a genuinely hard multiplication -- harder than 200/250/500 hitting the
// same cap with their smaller x5/x4/x2 factors. This reintroduces the
// "always reduces cleanly" artifact (10/40=1/4) that got the 200/250/500
// version of this same idea dropped earlier -- accepted here specifically
// because keeping the multiplication itself trivial mattered more for this
// one denominator's much bigger expansion factor.
const DECIMAL_L4_HARD_DENOMINATORS = [4, 8, 40, 200, 250, 500];
const DECIMAL_L4_HARD_CHANCE = 0.70;
const DECIMAL_L4_MEDIUM_DENOMINATORS = [2, 5, 20, 25, 50];
const DECIMAL_L4_MEDIUM_CHANCE = 0.20;
// The remaining 1 - (DECIMAL_L4_HARD_CHANCE + DECIMAL_L4_MEDIUM_CHANCE) =
// 10% falls back to DECIMAL_DENOMINATORS (10/100/1000, level 1's own pool)
// -- no dedicated chance constant of its own, same "leftover probability
// mass" convention DECIMAL_FRACTION_NAME_*_CHANCE's own comment above uses.

const LEVEL1_NUMS = [0, 1, 10];
const LEVEL2_NUMS = [2, 3, 5];
const LEVEL3_NUMS_FULL = [4, 6, 7, 8, 9];
const NON_LEVEL1_NUMS = [2, 3, 4, 5, 6, 7, 8, 9];

// Division-intro's own version of LEVEL1_NUMS with 0 excluded outright --
// "a×[]=0" has no single correct answer (any b works), so unlike
// multiplication's own level 1 (where 0×6=0 is a perfectly normal answer),
// 0 can never be a legal draw for a missing factor. See pickDivisionFactors()
// in exercise-division.js.
const DIVISION_LEVEL1_NUMS = [1, 10];

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
// else needs to change. nikud is at 5 now: level 1 is a fixed 4-letter pool
// (NIKUD_LEVEL1_LETTERS), level 2 is a random-5-of-8 pool (NIKUD_LEVEL2_LETTERS,
// added 2026-07-30 as a middle step), level 3 is a random-5-of-12 pool
// (NIKUD_LEVEL3_LETTERS, added 2026-08-23 as a further middle step), level 4
// is a random-5-of-16 pool (NIKUD_LEVEL4_LETTERS, added 2026-08-24 as a
// further middle step), level 5 is the original full-alphabet mechanic
// (bumped from level 2 on 2026-07-30, then level 3 on 2026-08-23, then level
// 4 to level 5 on 2026-08-24).
const EXERCISE_TOPIC_LEVEL_COUNTS = {
  multiplication: 5,
  fractions: 6, // level 1 added 2026-09-15: expand a reduced fraction by a stated multiplier X (old levels 1-5 became 2-6)
  comparefractions: 4, // level 5 was identical to level 4
  addfractions: 5, // level 3 added 2026-08-25: an expand-to-common-denominator scaffold between the old levels 2 and 3 (now 4)
  subtractfractions: 4,
  mixednumbers: 4,
  addfractionsadvanced: 4,
  letters: 2,          // levels 2-5 were identical to each other
  abc: 4,               // level 5 was identical to level 4
  nikud: 5,
  vocabulary: 4,       // level 2 added 2026-08-24: reverse direction. level 3 added same day: English word spoken via TTS instead of shown as text. level 4 added same day: Hebrew word shown, typed English answer
  division: 5,         // level 1 added 2026-08-24; levels 2-3 added 2026-08-27; levels 4-5 added same day, mirroring multiplication's own levels 2-5 (same EXERCISE_LEVEL_CONFIGS indices, see pickDivisionFactors() in exercise-division.js)
  grammar: 2,           // level 1 added 2026-08-30: English V1 shown, student types V2 (e.g. verb base form -> past tense), exact spelling. level 2 added same day: reverse direction (V2 shown, V1 typed). See exercise-grammar.js.
  // 'decimals' was a single 7-level topic through 2026-09-10, then split
  // into these two gameModes the same day (see DECIMALS_GROUP_TOPICS'
  // own comment above) once it had grown to mix two genuinely different
  // answer mechanics. Old level numbers below are kept for history --
  // trust EXERCISE_TOPIC_LEVEL_COUNTS/EXERCISE_LEVEL_DESCRIPTIONS'
  // current entries over any level-number claim in prose, here or
  // elsewhere, per [[project_decimals_topic_plan]] in memory.
  decimalstyped: 5,     // typed-decimal levels only, in their original relative order: level 1 = old level 1 (whole+fraction shown, denominator 10/100/1000, type the decimal). level 2 = old level 2, added 2026-09-10: shown the Hebrew *name* of a fraction, student writes both the fraction and the decimal. level 3 = old level 3: denominator drawn from 2/5/10/20/25/50/100 instead, mentally expand to tenths/hundredths first. level 4 = old level 5: same pool as level 3, but 40% of draws use denominator 4 or 8 instead. level 5 = old level 7, added 2026-09-10 same day: a three-tier denominator draw -- 70% one of 4/8/40/200/250/500 (see exercise-decimals.js's own drawDecimalLevel4HardNumerator() comment for how each of those got its numerator capped, after several rounds of user correction), 20% one of 2/5/20/25/50, 10% one of 10/100/1000.
  decimalnumberline: 2, // the number-line click UI, in their original relative order: level 1 = old level 4 (denominator 2/5/10 only, range 0-3, marked in tenths -- the only denominators landing exactly on a tenths tick). level 2 = old level 6: same mechanic, denominator pool widened (adds 4, minus 8 -- 8 doesn't divide 100 evenly), a single 0-to-1 line marked in hundredths instead, desktop-only.
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
    'מוצג שבר מצומצם (מכנה חד-ספרתי), וכיתוב "הרחיבו את השבר ב-X" עם מספר להרחבה X (חד-ספרתי גם הוא, בין 2 ל-9) -- יש להרחיב את השבר לפי X: למלא גם את המונה וגם את המכנה של השבר המורחב. לדוגמה: השבר 2/3 עם הכיתוב "הרחיבו ב-4" -- יש למלא 8/12.',
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
  vocabulary: [
    'מוצגת מילה באנגלית, ויש לבחור את התרגום הנכון שלה מתוך עד 5 מילים בעברית (פחות אם ברשימה שנטענה יש פחות מ-5 מילים).',
    'הפוך: מוצגת מילה בעברית, ויש לבחור את התרגום הנכון שלה באנגלית מתוך עד 5 אפשרויות.',
    'המילה באנגלית מוקראת בקול (לחיצה על 🔊) במקום להיות מוצגת בכתב, ויש לבחור את התרגום הנכון שלה מתוך עד 5 מילים בעברית.',
    'מוצגת מילה בעברית, ויש לכתוב את התרגום שלה באנגלית באיות נכון (לא בחירה מתוך אפשרויות).',
  ],
  nikud: [
    'שומעים אחת מ-4 האותיות א, ב, ג, ד עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 4 כפתורים קבועים, תמיד באותו סדר.',
    'שומעים אות עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות עם קמץ, מתוך 8 האותיות הראשונות (א-ח).',
    'שומעים אות עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות עם קמץ, מתוך 12 האותיות הראשונות (א-ל).',
    'שומעים אות עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות עם קמץ, מתוך 16 האותיות הראשונות (א-ע).',
    'שומעים אות עם ניקוד קמץ (לחיצה על 🔊) ובוחרים אותה מתוך 5 אותיות עם קמץ, מתוך כל האלף-בית.',
  ],
  addfractions: [
    'מוצגים שני שברים עם אותו מכנה (בין 3 ל-20) שסכומם קטן מהמכנה -- יש להשלים את מונה תוצאת החיבור. לדוגמה: 2/7 + 3/7 = ?/7. התוצאה תמיד שבר תקין ומצומצם מראש.',
    'כמו ברמה 1, אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של תוצאת החיבור בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים סכום המונים והמכנה כבר זרים זה לזה, כך שאין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
    'שלב ביניים לקראת הרמה הבאה: מוצגים שני שברים שבהם המכנה של אחד הוא כפולה של מכנה השני, בלי תיבת תוצאה לתרגיל החיבור עצמו. מתחתיו מוצג אותו תרגיל שוב, כאשר השבר בעל המכנה הקטן כבר נכתב מעל המכנה המשותף -- יש להשלים קודם את המונה שלו אחרי ההרחבה, ואז את מונה תוצאת החיבור. לדוגמה: 1/3 + 1/9 = , ומתחת: ⬜/9 + 1/9 = ⬜/9. מבודד את מיומנות ההרחבה למכנה משותף, לפני שדורשים גם לבצע את החיבור בעצמו.',
    'מוצגים שני שברים שבהם המכנה של השבר השני הוא כפולה של מכנה השבר הראשון (למשל 2/3 ו-5/9, כי 9=3×3) -- יש להרחיב את השבר הראשון למכנה המשותף (2/3=6/9) ואז לחבר את המונים. ב-10% מהמקרים המכנים זהים מלכתחילה (בדיוק כמו ברמה 1). התוצאה תמיד שבר תקין ומצומצם מראש.',
    'כמו ברמה 4, אבל בכל תרגיל -- בלי יוצא מן הכלל -- יש להשלים גם את המונה וגם את המכנה של תוצאת החיבור בצורתה המצומצמת. ב-70% מהמקרים באמת נדרש צמצום; ב-30% הנותרים אין מה לצמצם -- אבל אי אפשר לדעת מראש איזה מהם זה, כי הצורה זהה תמיד.',
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
  division: [
    'כמו רמה 1 בלוח הכפל (אותה התפלגות מספרים בדיוק), אבל בלי תרגילים שבהם אחד המוכפלים הוא 0 -- והפעם החסר הוא אחד המוכפלים (נבחר באקראי איזה מהם), לא התוצאה. לדוגמה: 2×[]=6.',
    'כמו רמה 2 בלוח הכפל (אותה התפלגות מספרים בדיוק), אבל בלי תרגילים שבהם אחד המוכפלים הוא 0 -- והפעם החסר הוא אחד המוכפלים (נבחר באקראי איזה מהם), לא התוצאה. לדוגמה: 4×[]=24.',
    'כמו רמה 3 בלוח הכפל (אותה התפלגות מספרים בדיוק), אבל בלי תרגילים שבהם אחד המוכפלים הוא 0 -- והפעם החסר הוא אחד המוכפלים (נבחר באקראי איזה מהם), לא התוצאה. לדוגמה: []×9=54.',
    'כמו רמה 4 בלוח הכפל (אותה התפלגות מספרים בדיוק, בלי 8), אבל בלי תרגילים שבהם אחד המוכפלים הוא 0 -- והפעם החסר הוא אחד המוכפלים (נבחר באקראי איזה מהם), לא התוצאה. לדוגמה: 7×[]=63.',
    'כמו רמה 5 בלוח הכפל -- הרמה הקשה ביותר, אותה התפלגות מספרים בדיוק (כולל צירופים כמו 7×8, 8×9, 9×9) -- אבל בלי תרגילים שבהם אחד המוכפלים הוא 0 -- והפעם החסר הוא אחד המוכפלים (נבחר באקראי איזה מהם), לא התוצאה. לדוגמה: 7×[]=56.',
  ],
  grammar: [
    'מוצגת מילה באנגלית (V1), ויש לכתוב את הצורה המקבילה שלה (V2, למשל צורת עבר של פועל) באיות מדויק -- אין בחירה מתוך אפשרויות.',
    'הפוך: מוצגת הצורה המקבילה (V2), ויש לכתוב את המילה המקורית (V1) באיות מדויק.',
  ],
  decimalstyped: [
    'מוצג מספר בצורת שלם + שבר (המכנה תמיד 10, 100 או 1000, בהסתברות שווה; המונה לעולם לא מתחלק ב-10), ויש לכתוב אותו כמספר עשרוני (למשל "3.05" -- מקובלים גם נקודה וגם פסיק כמפריד עשרוני). כשהמכנה 100, ב-50% מהמקרים המונה חד-ספרתי -- כדי לתרגל את ה-0 המחבר (למשל 3/100 = 0.03); כשהמכנה 1000, ב-25% מהמקרים המונה חד-ספרתי, ב-25% דו-ספרתי וב-50% תלת-ספרתי. ב-30% מהמקרים אין חלק שלם כלל (מוצג שבר בלבד, ללא "0" לפניו) -- אבל בתשובה העשרונית עדיין יש לכתוב את ה-0 שלפני הנקודה.',
    'מוצג שם של שבר בעברית (למשל "שלוש חמישיות" או "שבע עשרה מאיות"), ויש לכתוב אותו גם כשבר (מונה ומכנה) וגם כמספר עשרוני. ב-30% מהמקרים זהו שבר "מיוחד" -- חצי, רבע, חמישית או שמינית (בהסתברות שווה בין הארבעה; אלה היחידים מתחת ל-10 עם שם עברי קצר שגם ניתן לכתיבה עשרונית מדויקת). ב-30% נוספים זהו "X מאיות" (X בין 1 ל-99, לעולם לא כפולה של 10 -- ב-50% מהמקרים חד-ספרתי, ב-50% דו-ספרתי). ב-30% נוספים זהו "X אלפיות" (X בין 1 ל-999, באותה הסתברות שווה בין חד/דו/תלת-ספרתי). ב-10% הנותרים זהו "X עשיריות" (X בין 1 ל-9).',
    'כמו ברמה 1, אבל המכנה נבחר מתוך 2, 5, 10, 20, 25, 50 או 100 (בהסתברות שווה) -- מכנים שקל להרחיב לעשיריות (2, 5, 10) או למאיות (20, 25, 50, 100). יש להרחיב את השבר בראש -- לדוגמה 3/20 הופך ל-15/100 -- ואז לכתוב אותו כמספר עשרוני, בדיוק כמו ברמה 1. כשהמכנה 50 או 100, ב-50% מהמקרים המונה חד-ספרתי (לפני ההרחבה) כדי לתרגל את ה-0 המחבר -- לתשומת לב: במכנה 50 זה לא מבטיח שהתוצאה המורחבת תהיה חד-ספרתית (למשל 7/50 מורחב ל-14/100), וזה בסדר.',
    'כמו ברמה 3, אבל ב-40% מהמקרים המכנה קשה יותר -- 4 (הרחבה פי 25, למאיות) או 8 (הרחבה פי 125, לאלפיות), בהסתברות שווה בין השניים. ב-60% הנותרים המכנה נבחר בדיוק כמו ברמה 3 (מתוך 2, 5, 10, 20, 25, 50 או 100).',
    'כמו ברמה 1 (מוצג שלם + שבר, ויש לכתוב כמספר עשרוני), אבל המכנה נבחר מתוך 3 שכבות קושי: ב-70% מהמקרים מכנה "קשה" -- 4, 8, 40, 200, 250 או 500 (בהסתברות שווה); ב-20% מהמקרים מכנה "בינוני" -- 2, 5, 20, 25 או 50; וב-10% הנותרים מכנה "קל מאוד" -- 10, 100 או 1000 (בדיוק כמו ברמה 1, כולל אותה חלוקת ספרות למונה). במכנים 4, 8, 200, 250 ו-500 המונה מוגבל תמיד ל-20 לכל היותר (או למונה המקסימלי של אותו מכנה, אם הוא קטן מ-20) -- כדי שההרחבה למאיות/אלפיות תישאר כפל סביר. במכנה 40 (שההרחבה שלו פי 25, הגדולה מכולן) המונה מוגבל עוד יותר -- אחדות (1 עד 9) או עשרות שלמות (10, 20 או 30) בלבד -- כדי שהכפל בפועל יישאר תמיד כפל בספרה בודדת.',
  ],
  decimalnumberline: [
    'מוצג מספר בצורת שלם + שבר (המכנה 2, 5 או 10 בהסתברות שווה -- היחידים שנופלים בדיוק על שנת עשיריות), בטווח 0 עד 3. יש לבחור את הנקודה המתאימה על ציר מספרים המחולק לעשיריות (30 קטעים) -- לחיצה/הקשה בוחרת נקודה בלבד, ויש לאשר עם "בדוק" (או Enter) כדי לענות בפועל. אישור שגוי פוסל את הנקודה ההיא, וניתן לבחור מחדש מבין הנקודות הנותרות.',
    'מוצג שבר בלבד (בלי חלק שלם, כי הציר הוא בין 0 ל-1) -- המכנה נבחר מתוך 2, 5, 10, 20, 25, 50 או 100 ב-60% מהמקרים, או 4 ב-40% הנותרים (לא כולל 8, כי 8 אינו מתחלק ב-100 בדיוק ולכן שברים עם מכנה זה לא היו נופלים בדיוק על אף שנת). יש לבחור את הנקודה המתאימה על ציר מספרים רחב מ-0 עד 1, המחולק למאיות (100 שנתות) -- כמו ברמה 1, לחיצה בוחרת בלבד ויש לאשר עם "בדוק" (או Enter). מיועד למסך מחשב בלבד.',
  ],
};

// ---------- State ----------
let num1, num2;
let currentAnswer; // correct value for the current exercise, any mode
let currentLetterAnswer = null; // correct letter (a single character) for the current letters-mode exercise
let currentCompareAnswer = null; // correct '<'/'>' for the current comparefractions-mode exercise
let playerMoney = 0;
// Weak-pool state (see the WEAK_POOL_* constants above and the functions in
// exercise-core.js). Deliberately reset every startGame(), never persisted
// to localStorage -- a shared device could otherwise hand one kid's
// mistakes to whoever plays the next round.
let weakPoolReviewEnabled = true; // mirrors weakPoolCheckbox; synced in showInitialOverlay()/its own change listener (main.js)
let weakPool = []; // array of {ex, countdown}
let activePoolEntry = null; // the weakPool entry the current question was drawn from, or null if freshly generated
let currentExerciseSnapshot = null; // the current question's own generate*Exercise() result, ready to push into weakPool on a miss
let currentQuestionHadMistake = false; // whether the current question instance has had a wrong attempt yet -- decides recordWeakPoolRecovery()'s countdown if it's then answered correctly
let playerCastleHP = CASTLE_MAX_HP;
let computerCastleHP = CASTLE_MAX_HP;
let soldiers = [];
let soldierId = 0;
let gameOver = false;
let intervalId = null;
let animIntervalId = null;
let enemySpawnTimer = 0;
let enemySquadSize = ENEMY_SQUAD_MIN; // size the currently-gathering raider squad must reach before it attacks
let selectedIds = new Set();          // ids of the player's currently selected soldiers (see commands.js)
let mines = [];                       // per game: MINE_SITES + {owner, captureSide, captureMs}, see setupMines() in combat.js
let swapTimeoutId = null;
let battleElapsedMs = 0;

// Per-game session counters shown in .top-stats-row during play and again
// (bigger, centered) on the win/lose overlay -- see markCorrect()/markWrong()/
// changeQuestion() in exercise-core.js, which increment these, and
// updateStatsCountersDisplay() in the same file, which renders them.
let correctCount = 0;
let wrongCount = 0;
let swapCount = 0;
