import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { RecordingDoc } from '@/types/models';

export interface RecentRecordingState {
  recording: RecordingDoc | null;
  /** True until the pipeline writes processedAt on the recording doc. */
  processing: boolean;
  /** Live count of items the pipeline has produced for this recording. */
  itemCount: number;
}

const INITIAL: RecentRecordingState = {
  recording: null,
  processing: false,
  itemCount: 0,
};

/**
 * Watches the recording doc + its items so the home screen can show the
 * "X items captured" status without a manual refresh.
 */
export function useRecentRecording(
  recordingId: string | null,
): RecentRecordingState {
  const [state, setState] = useState<RecentRecordingState>(INITIAL);

  useEffect(() => {
    if (!recordingId) {
      setState(INITIAL);
      return;
    }
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setState({ recording: null, processing: true, itemCount: 0 });

    let unsubRecording: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function listenToRecording() {
      unsubRecording = onSnapshot(
        doc(db, 'recordings', recordingId!),
        (snap) => {
          if (!snap.exists()) {
            setState((s) => ({ ...s, recording: null, processing: true }));
            return;
          }
          const data = snap.data() as Omit<RecordingDoc, 'id'>;
          setState((s) => ({
            ...s,
            recording: { id: snap.id, ...data },
            processing: !data.processedAt,
          }));
        },
        () => {
          // permission-denied when doc doesn't exist yet; retry after the
          // Cloud Function has had time to create it.
          retryTimer = setTimeout(listenToRecording, 3000);
        },
      );
    }
    listenToRecording();

    const unsubItems = onSnapshot(
      query(
        collection(db, 'items'),
        where('userId', '==', userId),
        where('recordingId', '==', recordingId),
      ),
      (snap) => setState((s) => ({ ...s, itemCount: snap.size })),
      () => {},
    );

    return () => {
      unsubRecording?.();
      unsubItems();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [recordingId]);

  return state;
}
