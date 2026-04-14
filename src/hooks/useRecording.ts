import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

export interface RecordingState {
  isRecording: boolean;
  isUploading: boolean;
  /** Most recent metering reading, in dBFS (range roughly -160..0). */
  meterDb: number;
  elapsedMs: number;
  error: string | null;
}

const INITIAL_STATE: RecordingState = {
  isRecording: false,
  isUploading: false,
  meterDb: -160,
  elapsedMs: 0,
  error: null,
};

/**
 * Drives the recording UI: permission, start/stop, metering for the
 * waveform, and Storage upload that fires the processRecording Cloud
 * Function. Returns the new recordingId on a successful upload — the
 * caller stashes it in app state so the home screen can show
 * "X items captured" once Firestore reflects the pipeline output.
 *
 * Storage path: audio/{userId}/{recordingId}.m4a
 */
export function useRecording() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [state, setState] = useState<RecordingState>(INITIAL_STATE);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setState((s) => ({ ...s, error: 'Microphone permission denied.' }));
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recording.setProgressUpdateInterval(80);
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setState((s) => ({
            ...s,
            isRecording: true,
            meterDb: status.metering ?? -160,
            elapsedMs: status.durationMillis,
          }));
        }
      });
      await recording.startAsync();
      recordingRef.current = recording;
    } catch (err) {
      setState((s) => ({
        ...s,
        isRecording: false,
        error: (err as Error).message,
      }));
    }
  }, []);

  const stopAndUpload = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setState((s) => ({ ...s, error: 'Not signed in.' }));
      return null;
    }

    setState((s) => ({ ...s, isRecording: false, isUploading: true }));
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) {
        setState((s) => ({
          ...s,
          isUploading: false,
          error: 'No audio captured.',
        }));
        return null;
      }

      // Recording id: rough sortable + unique enough for MVP. The Cloud
      // Function strips the extension when it parses the path so this
      // becomes the Firestore doc id for both the recording and its items'
      // recordingId field.
      const recordingId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const path = `audio/${userId}/${recordingId}.m4a`;
      const blob = await fetch(uri).then((r) => r.blob());
      await uploadBytes(storageRef(storage, path), blob, {
        contentType: 'audio/m4a',
      });

      setState({ ...INITIAL_STATE });
      return recordingId;
    } catch (err) {
      setState((s) => ({
        ...s,
        isUploading: false,
        error: (err as Error).message,
      }));
      return null;
    }
  }, []);

  // Make sure we don't leak an in-flight recording if the screen unmounts
  // mid-capture (e.g., user backgrounds the app and we get torn down).
  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

  return { ...state, start, stopAndUpload };
}
