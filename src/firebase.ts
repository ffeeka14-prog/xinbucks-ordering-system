import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
const auth = getAuth(app);

// Simple anonymous sign in so we always have a real authenticated user ID in Firebase
signInAnonymously(auth)
  .then(() => {
    console.log('Signed in anonymously to Firebase!');
  })
  .catch((err) => {
    console.warn('Anonymous sign-in not enabled or failed. Falling back to local persistent UID:', err);
  });

// Validate connection as per skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'products', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('network'))) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}
testConnection();

export { app, db, auth };
