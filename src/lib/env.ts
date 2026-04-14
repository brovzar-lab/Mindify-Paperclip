// Typed accessors for Expo public env vars (EXPO_PUBLIC_*).
// These are inlined into the bundle at build time — never put secrets here.
// Server-side secrets (OpenAI, Anthropic keys) live in Cloud Functions config.

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env var: ${key}. See .env.example.`);
  }
  return value;
}

export const firebaseConfig = {
  apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: required('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: required('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: required('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: required('EXPO_PUBLIC_FIREBASE_APP_ID'),
};
