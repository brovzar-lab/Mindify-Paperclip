import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './env';

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Note: WS3 will switch to `initializeAuth` with AsyncStorage persistence
// during the mobile app pass so sessions survive app restarts. For the
// scaffold we use the default in-memory persistence.
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

/**
 * Sign in anonymously if no user is present. MVP is anonymous-only;
 * Apple/Google social auth is deferred (see TECHNICAL_PLAN.md).
 */
export function ensureAnonymousAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
          return;
        }
        try {
          const cred = await signInAnonymously(auth);
          unsubscribe();
          resolve(cred.user);
        } catch (err) {
          unsubscribe();
          reject(err);
        }
      },
      (err) => {
        unsubscribe();
        reject(err);
      },
    );
  });
}
