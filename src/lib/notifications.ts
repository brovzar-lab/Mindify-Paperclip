import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { useAppStore } from '@/state/store';

// Payload key we use on the notification so tapping it deep-links the
// right entity suggestion into the confirmation modal.
const ENTITY_PAYLOAD_KEY = 'entitySuggestionId';

/**
 * Configure how notifications behave while the app is in the foreground.
 * Call once at app start. Safe to call multiple times (expo dedupes).
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Request notification permission and persist the resulting Expo push
 * token onto the user's profile so we can later send server-driven
 * pushes (not used yet, but the token needs to be in place before we
 * turn those on). Returns true if permission was granted.
 */
export async function registerForEntityNotifications(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('entities', {
        name: 'Entity confirmations',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync().catch(
      () => null,
    );
    const user = auth.currentUser;
    if (user && tokenResponse?.data) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          createdAt: serverTimestamp(),
          settings: {
            notifications: true,
            expoPushToken: tokenResponse.data,
          },
        },
        { merge: true },
      );
    }
    return true;
  } catch (err) {
    console.warn('registerForEntityNotifications error:', err);
    return false;
  }
}

/**
 * Fire a local notification prompting the user to confirm a newly
 * detected entity ("Is Alex your daughter?"). Tapping it opens the
 * EntityConfirmationModal for the matching suggestion id.
 *
 * No-ops if notification permission has not been granted — the modal
 * will still appear in-app on the Brain screen.
 */
export async function scheduleEntityConfirmationNotification({
  suggestionId,
  name,
  relationship,
}: {
  suggestionId: string;
  name: string;
  relationship?: string;
}) {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Quick check',
        body: relationship
          ? `Is ${name} your ${relationship}? Tap to confirm.`
          : `Confirm who ${name} is.`,
        data: { [ENTITY_PAYLOAD_KEY]: suggestionId },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('scheduleEntityConfirmationNotification error:', err);
  }
}

/**
 * Install a single global listener that routes notification taps into
 * the Zustand store. BrainScreen reads `pendingEntitySuggestionId` to
 * decide whether to open the confirmation modal on mount / focus.
 *
 * Returns an unsubscribe function.
 */
export function installNotificationResponseListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const id = response.notification.request.content.data?.[
        ENTITY_PAYLOAD_KEY
      ] as string | undefined;
      if (id) {
        useAppStore.getState().setPendingEntitySuggestionId(id);
      }
    },
  );
  return () => sub.remove();
}
