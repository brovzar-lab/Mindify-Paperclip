import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Subscribe to Firebase auth state. Returns the current User or null.
 * Wrapped by AuthGate to ensure we always have a user before rendering
 * the navigator.
 */
export function useAuth(): User | null {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
