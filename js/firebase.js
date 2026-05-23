// ════════════════════════════════════════════
//   bé.ka Coffee & Space — AIS
//   firebase.js — Firestore Integration
//   Replace firebaseConfig with your own!
// ════════════════════════════════════════════

// ── FIREBASE CONFIG ──
// Replace these values with your Firebase project credentials
// Go to: console.firebase.google.com → Project Settings → Your Apps → SDK setup

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",          
  authDomain:        "YOUR_PROJECT_ID...",    
  projectId:         "YOUR_PROJECT_ID",      
  storageBucket:     "...",                   
  appId:             "..."                    
};


// ── FIREBASE STATE ──
let db = null;
let firebaseReady = false;
let useFirebase = false; // flips to true if Firebase init succeeds

// ── INIT ──
async function initFirebase() {
  // If config still has placeholders, skip Firebase silently
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn('[Firebase] No config — running in local-only mode.');
    showFirebaseStatus('local');
    return false;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    // Test connection with a small read
    await db.collection('_ping').limit(1).get();
    firebaseReady = true;
    useFirebase   = true;
    showFirebaseStatus('connected');
    console.log('[Firebase] Connected ✓');
    return true;
  } catch(e) {
    console.error('[Firebase] Init failed:', e.message);
    showFirebaseStatus('error', e.message);
    return false;
  }
}

function showFirebaseStatus() {
  const el = document.getElementById('fb-status');
  if (el) el.style.display = 'none';
}

// ── SAVE TRANSACTION ──
async function fbSaveTransaction(tx) {
  if (!useFirebase) return null;
  try {
    showFirebaseStatus('syncing');
    await db.collection('transactions').doc(String(tx.id)).set({
      ...tx,
      items: tx.items.map(i => ({id:i.id, name:i.name, cat:i.cat, price:i.price, qty:i.qty})),
      _saved: firebase.firestore.FieldValue.serverTimestamp()
    });
    showFirebaseStatus('connected');
    return true;
  } catch(e) {
    console.error('[Firebase] Save tx failed:', e);
    showFirebaseStatus('error', e.message);
    return false;
  }
}

// ── SAVE EXPENSE ──
async function fbSaveExpense(exp) {
  if (!useFirebase) return null;
  try {
    showFirebaseStatus('syncing');
    await db.collection('expenses').doc(String(exp.id)).set({
      ...exp,
      _saved: firebase.firestore.FieldValue.serverTimestamp()
    });
    showFirebaseStatus('connected');
    return true;
  } catch(e) {
    console.error('[Firebase] Save expense failed:', e);
    showFirebaseStatus('error', e.message);
    return false;
  }
}

// ── LOAD ALL DATA FROM FIRESTORE ──
async function fbLoadAll() {
  if (!useFirebase) return null;
  try {
    showFirebaseStatus('syncing');
    const [txSnap, expSnap] = await Promise.all([
      db.collection('transactions').orderBy('_ts','asc').get(),
      db.collection('expenses').orderBy('_ts','asc').get()
    ]);
    const txs  = txSnap.docs.map(d  => d.data());
    const exps = expSnap.docs.map(d => d.data());
    showFirebaseStatus('connected');
    return { transactions: txs, expenses: exps };
  } catch(e) {
    console.error('[Firebase] Load failed:', e);
    showFirebaseStatus('error', e.message);
    return null;
  }
}

// ── SEED FIRESTORE (run once) ──
async function fbSeedAll(txList, expList) {
  if (!useFirebase) return;
  const BATCH_SIZE = 400;

  console.log(`[Firebase] Seeding ${txList.length} transactions...`);
  showFirebaseStatus('syncing');

  // Transactions in batches
  for (let i = 0; i < txList.length; i += BATCH_SIZE) {
    const batch = db.batch();
    txList.slice(i, i + BATCH_SIZE).forEach(tx => {
      const ref = db.collection('transactions').doc(String(tx.id));
      batch.set(ref, {
        ...tx,
        items: tx.items.map(it => ({id:it.id,name:it.name,cat:it.cat,price:it.price,qty:it.qty})),
        _saved: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    console.log(`[Firebase] Tx batch ${i}–${i+BATCH_SIZE} done`);
  }

  // Expenses in batches
  for (let i = 0; i < expList.length; i += BATCH_SIZE) {
    const batch = db.batch();
    expList.slice(i, i + BATCH_SIZE).forEach(exp => {
      const ref = db.collection('expenses').doc(String(exp.id));
      batch.set(ref, {
        ...exp,
        _saved: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    console.log(`[Firebase] Exp batch ${i}–${i+BATCH_SIZE} done`);
  }

  showFirebaseStatus('connected');
  console.log('[Firebase] Seed complete ✓');
}

async function fbDeleteTransaction(id) {
  if (!useFirebase) return true;
  try {
    await db.collection('transactions').doc(String(id)).delete();
    return true;
  } catch (e) {
    console.error('[Firebase] Delete tx failed:', e.message);
    return false;
  }
}

async function fbDeleteExpense(id) {
  if (!useFirebase) return true;
  try {
    await db.collection('expenses').doc(String(id)).delete();
    return true;
  } catch (e) {
    console.error('[Firebase] Delete exp failed:', e.message);
    return false;
  }
}

async function fbSaveDeletionLog(entry) {
  if (!useFirebase) return;
  try {
    await db.collection('deletion_log').doc(String(entry.id)).set({
      ...entry,
      _saved: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('[Firebase] Save deletion log failed:', e.message);
  }
}
