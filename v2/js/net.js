// ---------- Network: Firebase Realtime Database (PvP only) ----------
// See [[project_pvp_plan]] in memory. GitHub Pages only serves static files,
// so the two players' browsers talk through a Firebase Realtime Database
// (project "mathapp-pvp"): a shared JSON tree both sides read and write,
// which pushes every change to whoever is listening.
//
// The SDK is only downloaded when PvP is actually used (teacher screen or a
// student's room link), so the normal game doesn't pay for it. It's the
// "compat" build: plain <script> files exposing one global `firebase`, which
// fits this project's no-build, no-modules setup.
//
// This web config is NOT a secret -- Firebase web configs are meant to be
// public (they end up in every visitor's browser anyway). What protects the
// data is the database's security rules, set in the Firebase console
// (see FIREBASE_RULES.json next to index.html).
//
// Database layout:
//   rooms/<roomId>/
//     createdAt        server timestamp
//     createdBy        uid of the teacher's (anonymous) session
//     config/
//       player/   {topic, level, review, soldierCost, correctReward,
//                  mineBonus, wrongPenalty, swapAllowed, swapCost}   (blue)
//       computer/ { ...same... }                                      (red)
//     seats/<side>/ {uid, online, ready}  -- the lobby (joinRoom() below)
//     startAt          server timestamp, written once when both are ready;
//                      both browsers start the match PVP_COUNTDOWN_MS after it

const FIREBASE_SDK_VERSION = '12.19.0';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDBxwUHt3ho8RKvimVAK0JkHJ4z7D9es28',
  authDomain: 'mathapp-pvp.firebaseapp.com',
  databaseURL: 'https://mathapp-pvp-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'mathapp-pvp',
  storageBucket: 'mathapp-pvp.firebasestorage.app',
  messagingSenderId: '889844700444',
  appId: '1:889844700444:web:1bed40d89f53e3392856d9'
};

// Link sides: the URL says blue/red, the code's team ids are player/computer
// (see match.js).
const URL_PARAM_ROOM = 'room';
const URL_PARAM_SIDE = 'side';
const URL_SIDE_TO_TEAM = { blue: 'player', red: 'computer' };
const TEAM_TO_URL_SIDE = { player: 'blue', computer: 'red' };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(el);
  });
}

// Resolves to the database once the SDK is loaded and this browser is
// signed in (anonymously -- no account, just a random id the security rules
// can check). Runs once; later calls reuse the same promise.
let firebaseReady = null;
function connectFirebase() {
  if (!firebaseReady) {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
    firebaseReady = loadScript(`${base}/firebase-app-compat.js`)
      .then(() => Promise.all([
        loadScript(`${base}/firebase-auth-compat.js`),
        loadScript(`${base}/firebase-database-compat.js`)
      ]))
      .then(() => {
        firebase.initializeApp(FIREBASE_CONFIG);
        return firebase.auth().signInAnonymously();
      })
      .then(() => firebase.database())
      .catch((err) => {
        firebaseReady = null; // let a later attempt retry from scratch
        throw err;
      });
  }
  return firebaseReady;
}

// Random room id, unguessable enough that nobody can stumble into another
// class's game (the rules don't allow listing rooms, only opening one by id).
function newRoomId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // no look-alikes (l/1, o/0)
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

// Teacher: stores the match settings as a new room, returns its id.
async function createRoom(config) {
  const db = await connectFirebase();
  const roomId = newRoomId();
  await db.ref(`rooms/${roomId}`).set({
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    createdBy: firebase.auth().currentUser.uid,
    config
  });
  return roomId;
}

// Student: reads a room's settings; null if there's no such room.
async function fetchRoomConfig(roomId) {
  const db = await connectFirebase();
  const snap = await db.ref(`rooms/${roomId}/config`).get();
  return snap.exists() ? snap.val() : null;
}

// ---------- The lobby: seats, ready, synchronized start ----------
// Each student's browser sits in its team's seat: {uid, online, ready}.
// `online` is presence -- Firebase itself flips it to false (and cancels
// `ready`) if the tab closes or the connection drops (onDisconnect). A seat
// belongs to whoever took it, but a seat whose owner is offline can be taken
// over (e.g. the student moved to another computer) -- see the rules.
//
// Clocks: every computer's own clock is a bit off, so the start moment is a
// Firebase *server* timestamp, and each browser converts it with its own
// measured offset from the server clock (.info/serverTimeOffset). That way
// both countdowns hit zero at the same real moment.
let serverTimeOffset = 0;

function serverNow() {
  return Date.now() + serverTimeOffset;
}

// Joins `team`'s seat in the room and keeps it (re-claimed after every
// reconnect). onRoom(room) is called with the whole room snapshot on every
// change. Resolves to an object with setReady()/requestStart(); rejects with
// code 'SEAT_TAKEN' if someone else is online in that seat.
async function joinRoom(roomId, team, onRoom) {
  const db = await connectFirebase();
  const uid = firebase.auth().currentUser.uid;
  const roomRef = db.ref(`rooms/${roomId}`);
  const seatRef = roomRef.child(`seats/${team}`);

  db.ref('.info/serverTimeOffset').on('value', snap => { serverTimeOffset = snap.val() || 0; });

  // Sit down first, then register the "mark me offline" instruction -- the
  // rules only accept it for a seat that's already ours.
  const claim = async () => {
    await seatRef.set({ uid, online: true, ready: false });
    await seatRef.onDisconnect().update({ online: false, ready: false });
  };
  try {
    await claim();
  } catch (err) {
    if (!/permission/i.test(err.code || err.message)) throw err;
    const e = new Error('seat taken');
    e.code = 'SEAT_TAKEN';
    throw e;
  }
  // After a dropped connection comes back, sit down again (Firebase already
  // marked us offline when it dropped).
  let firstConnect = true;
  db.ref('.info/connected').on('value', snap => {
    if (!snap.val()) return;
    if (firstConnect) { firstConnect = false; return; }
    claim().catch(err => console.error('re-claiming seat failed', err));
  });

  roomRef.on('value', snap => onRoom(snap.val()));

  return {
    uid,
    setReady: ready => seatRef.update({ ready }),
    // Both are ready: fix the start moment. Both browsers may try at once,
    // so it's a transaction that only writes while startAt is still empty.
    // applyLocally=false matters: a plain set() shows up in this browser's
    // own listeners *before* the server accepts it, so a rejected or
    // losing write could start a countdown to the wrong moment. This way
    // both browsers only ever see the one value the server kept.
    requestStart: () => roomRef.child('startAt')
      .transaction(cur => (cur == null ? firebase.database.ServerValue.TIMESTAMP : undefined), null, false)
      .catch(err => console.error('setting the start moment failed', err))
  };
}

function buildRoomLink(roomId, team) {
  const params = new URLSearchParams({ [URL_PARAM_ROOM]: roomId, [URL_PARAM_SIDE]: TEAM_TO_URL_SIDE[team] });
  return `${location.protocol}//${location.host}${location.pathname}?${params}`;
}
