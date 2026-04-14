import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
// getReactNativePersistence is exported but not always re-exported in the
// public typings — bypass the type check rather than pin to a deeper import
// path that varies between firebase versions.
// @ts-expect-error -- runtime export, missing from `firebase/auth` types
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './env';

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// initializeAuth can only be called once per app — wrap in try/catch so the
// fallback path covers Fast Refresh re-imports during dev. Persistence via
// AsyncStorage is what makes the anonymous UID survive app restarts.
let _auth: Auth;
try {
  _auth = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  _auth = getAuth(firebaseApp);
}
export const auth = _auth;

export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

/**
 * Ensure the user is signed in. Resolves with the existing User if one
 * exists, otherwise creates a new anonymous account and resolves with it.
 * MVP is anonymous-only; Apple/Google social auth is deferred per the
 * technical plan.
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
