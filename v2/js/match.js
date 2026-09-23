// ---------- Match: the two sides, their settings and money, and the command funnel ----------
// Groundwork for PvP (see [[project_pvp_plan]] in memory).
//
// Team ids: the code has always called the two teams 'player' and
// 'computer' (plus 'neutral' for the purple mine guards), and style.css /
// the art are keyed on those names -- so they stay, but they now mean
// "the BLUE team" (right tower) and "the RED team" (left tower), not
// "the human" and "the computer". Which team THIS browser plays is
// `localSide`; everything that means "me" (fog, selection, coins shown, buy
// button, which castle is "the enemy") goes through it.
//
// matchMode:
//   'computer' -- the normal game: this browser is blue, red is the enemy AI.
//   'hotseat'  -- debug/playtest mode (open v2 with ?hotseat=1): no enemy AI,
//                 both teams are human, and a button switches which team this
//                 one browser is currently playing. Stand-in for PvP until
//                 the network part exists.
//   'pvp'      -- opened from a room link the teacher created (pvp-ui.js):
//                 localSide is that link's team, and both teams' settings
//                 come from the room (matchConfig).
//
// The command funnel: every action a player takes that changes the battle
// (buy, move, attack, correct/wrong answer, swap, surrender) is described
// as a small plain object and handed to issueCommand(). Today that applies
// it right away; with PvP, the guest's browser will send the same object
// over the network to the host, which applies it for the guest's side.
// (In C# terms: a command-pattern message, but as a plain data object
// rather than a class, so it can be sent as JSON as-is.)

let matchMode = 'computer';
let localSide = 'player';

const SIDE_NAMES = { player: 'כחול', computer: 'אדום' };

// Per-side settings. Defaults = the classic game's constants (config.js).
// In PvP the teacher screen will fill these per side.
function defaultSideParams() {
  return {
    soldierCost: SOLDIER_COST,
    correctReward: CORRECT_REWARD,
    mineBonus: MINE_BONUS,
    wrongPenalty: WRONG_PENALTY,
    swapAllowed: true,
    swapCost: SWAP_QUESTION_COST
  };
}

// Per-game state of each team: its settings and its coins.
let sides = {};

function setupSides() {
  const paramsOf = team => (matchMode === 'pvp' && matchConfig ? { ...matchConfig[team] } : defaultSideParams());
  sides = {
    player: { params: paramsOf('player'), money: 0 },
    computer: { params: paramsOf('computer'), money: 0 }
  };
}

function enemyOf(side) {
  return side === 'player' ? 'computer' : 'player';
}

function castlePos(side) {
  return side === 'player' ? PLAYER_CASTLE_POS : COMPUTER_CASTLE_POS;
}

// Where a team's newly bought soldiers appear: blue's PLAYER_RALLY, and
// red's is its mirror image at the left tower (the map is symmetric).
function rallyPoint(side) {
  return side === 'player' ? PLAYER_RALLY : { x: WORLD_W - PLAYER_RALLY.x, y: PLAYER_RALLY.y };
}

// The castle graphic a team's soldiers attack (right-click target).
function castleGraphicId(side) {
  return side === 'player' ? 'playerCastleGraphic' : 'enemyCastleGraphic';
}

function myParams() {
  return sides[localSide].params;
}

function myMoney() {
  return sides[localSide].money;
}

// Coins one correct answer is worth to a team right now.
function rewardFor(side) {
  const p = sides[side].params;
  return p.correctReward + p.mineBonus * mineCount(side);
}

function ownLivingSoldier(side, id) {
  return soldiers.find(s => s.id === id && s.side === side && !s.dying);
}

// Everything the local player does to the battle goes through here.
function issueCommand(cmd) {
  applyCommand(localSide, cmd);
}

// Applies one command for `side`. Validates it against the current state
// (e.g. only that side's own living soldiers can be ordered), since with
// PvP it may arrive from another browser a moment late.
//   {type: 'buy'}
//   {type: 'move', orders: [[soldierId, x, y], ...]}
//   {type: 'attack', ids: [soldierId, ...]}      -- besiege the enemy castle
//   {type: 'correct'} / {type: 'wrong'} / {type: 'swap'}  -- coin changes
//   {type: 'surrender'}
function applyCommand(side, cmd) {
  if (gameOver) return;
  const team = sides[side];
  switch (cmd.type) {
    case 'buy':
      buySoldier(side);
      break;
    case 'move':
      for (const [id, x, y] of cmd.orders) {
        const s = ownLivingSoldier(side, id);
        if (s) s.order = { x, y };
      }
      break;
    case 'attack': {
      const target = castlePos(enemyOf(side));
      for (const id of cmd.ids) {
        const s = ownLivingSoldier(side, id);
        if (s) s.order = { x: target.x, y: target.y, castle: true };
      }
      break;
    }
    case 'correct':
      team.money = Math.min(MAX_COINS, team.money + rewardFor(side));
      break;
    case 'wrong':
      team.money -= team.params.wrongPenalty;
      break;
    case 'swap':
      team.money -= team.params.swapCost;
      break;
    case 'surrender':
      finishMatch(enemyOf(side), true);
      return;
  }
  updateCoinsDisplay();
}

// The battle is decided (a castle fell, or a side surrendered). This
// browser shows a win or a loss depending on which team it plays.
function finishMatch(winnerSide, surrendered) {
  endGame(winnerSide === localSide, surrendered);
}

// ---------- Side-dependent HUD ----------
// The two castle blocks under the board are fixed in place (red's on the
// left, blue's on the right, like the towers); their labels and the buy
// button follow whichever team this browser plays.
function applySideHud() {
  document.getElementById('enemyCastleLabel').textContent = localSide === 'computer' ? 'אתה' : 'האויב';
  document.getElementById('playerCastleLabel').textContent = localSide === 'player' ? 'אתה' : 'האויב';
  placeBuyBtn();
  const p = myParams();
  const swapBtn = document.getElementById('swapBtn');
  swapBtn.style.display = p.swapAllowed ? '' : 'none';
  swapBtn.textContent = `החלף שאלה (עלות: ${p.swapCost} מטבעות)`;
  const hotseatBtn = document.getElementById('hotseatSwitchBtn');
  hotseatBtn.style.display = matchMode === 'hotseat' ? '' : 'none';
  hotseatBtn.textContent = `🔄 משחק כעת: ${SIDE_NAMES[localSide]} -- החלף צד`;
  hotseatBtn.className = `hotseat-btn side-${localSide}`;
  updateCoinsDisplay();
}

// Hot-seat only: hand this browser over to the other team.
function switchHotseatSide() {
  if (matchMode !== 'hotseat' || gameOver) return;
  localSide = enemyOf(localSide);
  selectedIds.clear();
  applySideHud();
  const home = castlePos(localSide);
  scrollBoardTo(home.x, home.y);
  render();
}
