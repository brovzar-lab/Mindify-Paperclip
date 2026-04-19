import { create } from 'zustand';
import type { EnergyLevel } from '@/types/models';

interface AppState {
  /**
   * ID of the recording the user just completed. Drives the
   * "X items captured → view brain" status row on the home screen.
   * Cleared by the user navigating to The Brain or starting a new recording.
   */
  lastRecordingId: string | null;
  setLastRecordingId: (id: string | null) => void;
  /**
   * Client-side energy filter for the Brain screen. Empty array = no
   * filter (show everything). Stored here rather than on the user doc
   * because it's session-local UI state, not a persistent preference.
   */
  selectedEnergyLevels: EnergyLevel[];
  setSelectedEnergyLevels: (levels: EnergyLevel[]) => void;
  toggleEnergyLevel: (level: EnergyLevel) => void;
  /**
   * Deep-link target: when the user taps an entity-confirmation
   * notification, the OS launches the app and this id is set so the
   * BrainScreen can open the confirmation modal for it on mount.
   */
  pendingEntitySuggestionId: string | null;
  setPendingEntitySuggestionId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  lastRecordingId: null,
  setLastRecordingId: (id) => set({ lastRecordingId: id }),
  selectedEnergyLevels: [],
  setSelectedEnergyLevels: (levels) => set({ selectedEnergyLevels: levels }),
  toggleEnergyLevel: (level) => {
    const current = get().selectedEnergyLevels;
    set({
      selectedEnergyLevels: current.includes(level)
        ? current.filter((l) => l !== level)
        : [...current, level],
    });
  },
  pendingEntitySuggestionId: null,
  setPendingEntitySuggestionId: (id) => set({ pendingEntitySuggestionId: id }),
}));
