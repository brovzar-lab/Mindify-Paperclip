import { useCallback, useEffect, useState } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
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

export function useRecording() {
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (status) => {
      if (status.hasError) {
        setState((s) => ({ ...s, error: status.error }));
      }
    },
  );
  const recorderState = useAudioRecorderState(recorder, 80);
  const [state, setState] = useState<RecordingState>(INITIAL_STATE);

  useEffect(() => {
    if (recorderState.isRecording) {
      setState((s) => ({
        ...s,
        isRecording: true,
        meterDb: recorderState.metering ?? -160,
        elapsedMs: recorderState.durationMillis,
      }));
    }
  }, [recorderState]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setState((s) => ({ ...s, error: 'Microphone permission denied.' }));
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      setState((s) => ({
        ...s,
        isRecording: false,
        error: (err as Error).message,
      }));
    }
  }, [recorder]);

  const stopAndUpload = useCallback(async (): Promise<string | null> => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setState((s) => ({ ...s, error: 'Not signed in.' }));
      return null;
    }

    setState((s) => ({ ...s, isRecording: false, isUploading: true }));
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setState((s) => ({
          ...s,
          isUploading: false,
          error: 'No audio captured.',
        }));
        return null;
      }

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
  }, [recorder]);

  return { ...state, start, stopAndUpload };
}
