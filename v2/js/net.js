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
//     seats/<side>/ {uid, ready}   -- filled in by the lobby (step 3)

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

function buildRoomLink(roomId, team) {
  const params = new URLSearchParams({ [URL_PARAM_ROOM]: roomId, [URL_PARAM_SIDE]: TEAM_TO_URL_SIDE[team] });
  return `${location.protocol}//${location.host}${location.pathname}?${params}`;
}
