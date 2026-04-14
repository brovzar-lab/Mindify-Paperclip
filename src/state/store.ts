import { create } from 'zustand';

interface AppState {
  /**
   * ID of the recording the user just completed. Drives the
   * "X items captured → view brain" status row on the home screen.
   * Cleared by the user navigating to The Brain or starting a new recording.
   */
  lastRecordingId: string | null;
  setLastRecordingId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  lastRecordingId: null,
  setLastRecordingId: (id) => set({ lastRecordingId: id }),
}));
