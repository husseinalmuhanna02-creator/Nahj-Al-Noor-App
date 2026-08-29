import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import config from '../../firebase-applet-config.json';

// Log clear debug information for the environment
if (!config || !config.apiKey || config.apiKey === 'placeholder' || !config.projectId) {
  console.error(
    "🔥 [Firebase Error]: Missing or invalid keys configuration inside 'firebase-applet-config.json'. " +
    "Please run Firebase setup to configure properly. apiKey: " + (config?.apiKey || "MISSING") + 
    ", projectId: " + (config?.projectId || "MISSING")
  );
} else {
  console.log("ℹ️ [Firebase info]: Configuration successfully loaded. Project: " + config.projectId);
}

// Initialize or get App
export const app = getApps().length > 0 ? getApp() : initializeApp(config);

// Direct, simple Firestore database export without any extra arguments
export const db = getFirestore(app);

// Direct Realtime Database export
export const rtdb = getDatabase(app);

// Direct, simple Authentication export
export const auth = getAuth(app);

export const isFirebaseEnabled = () => {
  return !!app && !!config.apiKey && config.apiKey !== 'placeholder';
};

// Reset Firestore support
export const resetFirestore = async () => {
  return db;
};

