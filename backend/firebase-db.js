const admin = require('firebase-admin');

let firestore = null;
var initialized = false;

function initialize() {
  if (initialized) return;
  var saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  var saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!saJson && !saPath) {
    console.log('Firebase: not configured (set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH)');
    return;
  }
  try {
    var credential;
    if (saJson) {
      credential = admin.credential.cert(JSON.parse(saJson));
    } else {
      credential = admin.credential.cert(require(saPath));
    }
    admin.initializeApp({ credential });
    firestore = admin.firestore();
    firestore.settings({ ignoreUndefinedProperties: true });
    initialized = true;
    console.log('Firebase: initialized successfully');
  } catch (err) {
    console.error('Firebase: init failed -', err.message);
  }
}

async function readDocument(name) {
  if (!initialized || !firestore) return null;
  try {
    var snap = await firestore.collection('app').doc(name).get();
    return snap.exists ? snap.data().value : null;
  } catch (err) {
    console.error('Firebase: read error -', err.message);
    return null;
  }
}

async function writeDocument(name, value) {
  if (!initialized || !firestore) return;
  try {
    await firestore.collection('app').doc(name).set({ value });
  } catch (err) {
    console.error('Firebase: write error -', err.message);
  }
}

function isEnabled() {
  return initialized;
}

module.exports = { initialize, readDocument, writeDocument, isEnabled };
