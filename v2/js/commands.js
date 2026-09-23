// ---------- Player commands: Warcraft-style select + move ----------
// Left-click a soldier to select it, left-drag a box to select every soldier
// it touches (Shift adds to the current selection instead of replacing it),
// left-click empty ground to deselect. Right-click the ground to send the
// selection there in a small formation, or right-click the enemy castle to
// send them to besiege it. What soldiers do once ordered (including
// breaking off to fight nearby enemies) is combat.js's job -- this file
// only turns mouse input into selectedIds and s.order.
//
// Because the board is flat (no camera tilt -- see config.js's board
// section), turning a mouse position into a board position is just a
// proportion of the board's on-screen rectangle.

const DRAG_THRESHOLD_PX = 5;
const FORMATION_SPACING = 5;
// A soldier's clickable area around its feet point, in board units --
// roughly the visible knight inside its (mostly transparent) sprite frame.
const SOLDIER_HIT_HALF_W = 2.5;
const SOLDIER_HIT_ABOVE = 6;
const SOLDIER_HIT_BELOW = 0.8;

let dragStart = null; // {clientX, clientY, additive} while the left button is held

function boardEl() {
  return document.getElementById('battlefieldPlane');
}

function clientToBoard(clientX, clientY) {
  const r = boardEl().getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(WORLD_W, (clientX - r.left) / r.width * WORLD_W)),
    y: Math.max(0, Math.min(WORLD_H, (clientY - r.top) / r.height * WORLD_H))
  };
}

function livingPlayerSoldiers() {
  return soldiers.filter(s => s.side === 'player' && !s.dying);
}

function soldierHitBox(s) {
  return {
    left: s.x - SOLDIER_HIT_HALF_W, right: s.x + SOLDIER_HIT_HALF_W,
    top: s.y - SOLDIER_HIT_ABOVE, bottom: s.y + SOLDIER_HIT_BELOW
  };
}

// Frontmost (largest y, i.e. drawn on top) player soldier under the point.
function playerSoldierAt(p) {
  let best = null;
  for (const s of livingPlayerSoldiers()) {
    const b = soldierHitBox(s);
    if (p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom) {
      if (!best || s.y > best.y) best = s;
    }
  }
  return best;
}

function selectionBoxEl() {
  let el = document.getElementById('selectionBox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'selectionBox';
    el.className = 'selection-box';
    boardEl().appendChild(el);
  }
  return el;
}

function hideSelectionBox() {
  const el = document.getElementById('selectionBox');
  if (el) el.style.display = 'none';
}

function isBattleInteractive() {
  return !gameOver && !document.querySelector('.overlay.show');
}

function onBoardMouseMove(e) {
  if (!dragStart) return;
  const dx = e.clientX - dragStart.clientX;
  const dy = e.clientY - dragStart.clientY;
  if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX && !dragStart.dragging) return;
  dragStart.dragging = true;

  const r = boardEl().getBoundingClientRect();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const x1 = clamp(dragStart.clientX, r.left, r.right) - r.left;
  const y1 = clamp(dragStart.clientY, r.top, r.bottom) - r.top;
  const x2 = clamp(e.clientX, r.left, r.right) - r.left;
  const y2 = clamp(e.clientY, r.top, r.bottom) - r.top;
  const el = selectionBoxEl();
  el.style.display = 'block';
  el.style.left = `${Math.min(x1, x2)}px`;
  el.style.top = `${Math.min(y1, y2)}px`;
  el.style.width = `${Math.abs(x2 - x1)}px`;
  el.style.height = `${Math.abs(y2 - y1)}px`;
}

function onBoardMouseUp(e) {
  document.removeEventListener('mousemove', onBoardMouseMove);
  document.removeEventListener('mouseup', onBoardMouseUp);
  if (!dragStart) return;
  const start = dragStart;
  dragStart = null;
  hideSelectionBox();
  if (!isBattleInteractive()) return;

  if (!start.additive) selectedIds.clear();

  if (start.dragging) {
    const a = clientToBoard(start.clientX, start.clientY);
    const b = clientToBoard(e.clientX, e.clientY);
    const box = {
      left: Math.min(a.x, b.x), right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y)
    };
    for (const s of livingPlayerSoldiers()) {
      const h = soldierHitBox(s);
      const overlaps = h.left <= box.right && h.right >= box.left &&
                       h.top <= box.bottom && h.bottom >= box.top;
      if (overlaps) selectedIds.add(s.id);
    }
  } else {
    const s = playerSoldierAt(clientToBoard(e.clientX, e.clientY));
    if (s) {
      // Shift-click toggles one soldier in/out, like Warcraft.
      if (start.additive && selectedIds.has(s.id)) selectedIds.delete(s.id);
      else selectedIds.add(s.id);
    }
  }
  renderSoldiers();
}

// Grid of distinct target points centered on the click, filled row by row
// with soldiers sorted top-to-bottom then left-to-right, so a group keeps
// roughly its shape and nobody crosses through the whole group to get there.
function formationTargets(group, center) {
  const n = group.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const sorted = [...group].sort((a, b) => a.y - b.y);
  const targets = new Map();
  for (let row = 0; row < rows; row++) {
    const rowSoldiers = sorted.slice(row * cols, (row + 1) * cols).sort((a, b) => a.x - b.x);
    rowSoldiers.forEach((s, col) => {
      const x = center.x + (col - (rowSoldiers.length - 1) / 2) * FORMATION_SPACING;
      const y = center.y + (row - (rows - 1) / 2) * FORMATION_SPACING;
      targets.set(s.id, {
        x: Math.max(0, Math.min(WORLD_W, x)),
        y: Math.max(Y_MOVE_MIN, Math.min(Y_MOVE_MAX, y))
      });
    });
  }
  return targets;
}

function showMoveMarker(p, isAttack) {
  const el = document.createElement('div');
  el.className = 'move-marker' + (isAttack ? ' attack' : '');
  el.style.left = `${p.x / WORLD_W * 100}%`;
  el.style.top = `${p.y / WORLD_H * 100}%`;
  boardEl().appendChild(el);
  setTimeout(() => el.remove(), 700);
}

function pointInElement(el, clientX, clientY) {
  const r = el.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

function onBoardRightClick(e) {
  e.preventDefault(); // no browser context menu on the board
  if (!isBattleInteractive()) return;
  const group = livingPlayerSoldiers().filter(s => selectedIds.has(s.id));
  if (!group.length) return;

  if (pointInElement(document.getElementById('enemyCastleGraphic'), e.clientX, e.clientY)) {
    for (const s of group) {
      s.order = { x: COMPUTER_CASTLE_POS.x, y: COMPUTER_CASTLE_POS.y, castle: true };
    }
    showMoveMarker(COMPUTER_CASTLE_POS, true);
    return;
  }

  const p = clientToBoard(e.clientX, e.clientY);
  const targets = formationTargets(group, p);
  for (const s of group) s.order = targets.get(s.id);
  showMoveMarker(p, false);
}

function onBoardMouseDown(e) {
  // A press on the horizontal scrollbar targets .battlefield itself (the
  // board plane is its only child) -- leave that entirely to the browser.
  if (e.target === e.currentTarget) return;
  // Keeps keyboard focus in the answer box (clicking a non-focusable div
  // would otherwise blur it, and the student would have to click back
  // before typing the next answer) and stops the drag from selecting text.
  e.preventDefault();
  if (e.button !== 0 || !isBattleInteractive()) return;
  dragStart = { clientX: e.clientX, clientY: e.clientY, additive: e.shiftKey, dragging: false };
  document.addEventListener('mousemove', onBoardMouseMove);
  document.addEventListener('mouseup', onBoardMouseUp);
}

document.getElementById('battlefield').addEventListener('mousedown', onBoardMouseDown);
document.getElementById('battlefield').addEventListener('contextmenu', onBoardRightClick);

// ---------- Keyboard map scrolling: number-pad arrows ----------
// The number-pad 4/6 keys scroll the board left/right, while the regular
// arrow keys keep doing what they always did inside the exercise. Only with
// NumLock OFF: then those keys report e.key 'ArrowLeft'/'ArrowRight' but
// e.code 'Numpad4'/'Numpad6', which is how they're told apart from the
// regular arrows. With NumLock ON they're plain digits and are left alone,
// since kids type answers on the number pad.
// Scrolls smoothly for as long as the key is held (not in keyboard-repeat
// jumps). Listens in the capture phase and stops the event there, so the
// exercise's own arrow-key handlers (main.js) never see these keys at all.
const KEY_SCROLL_PX_PER_SEC = 700;
const NUMPAD_SCROLL_DIR = { Numpad4: -1, Numpad6: 1 };
const heldScrollKeys = new Set();
let keyScrollLastTime = null;

function keyScrollFrame(now) {
  if (!heldScrollKeys.size) { keyScrollLastTime = null; return; }
  const dt = keyScrollLastTime == null ? 16 : now - keyScrollLastTime;
  keyScrollLastTime = now;
  let dir = 0;
  for (const code of heldScrollKeys) dir += NUMPAD_SCROLL_DIR[code];
  document.getElementById('battlefield').scrollLeft += dir * KEY_SCROLL_PX_PER_SEC * dt / 1000;
  requestAnimationFrame(keyScrollFrame);
}

window.addEventListener('keydown', (e) => {
  if (!(e.code in NUMPAD_SCROLL_DIR)) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; // NumLock on: a digit
  e.preventDefault();
  e.stopPropagation();
  if (!isBattleInteractive()) return;
  if (!heldScrollKeys.size) requestAnimationFrame(keyScrollFrame);
  heldScrollKeys.add(e.code);
}, true);

window.addEventListener('keyup', (e) => {
  heldScrollKeys.delete(e.code);
}, true);

// A key released while the window was in the background never sends keyup.
window.addEventListener('blur', () => heldScrollKeys.clear());
