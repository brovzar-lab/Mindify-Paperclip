import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { RecordButton } from '@/components/RecordButton';
import { RecordingWaveform } from '@/components/RecordingWaveform';
import { NextActionCard } from '@/components/NextActionCard';
import { useRecording } from '@/hooks/useRecording';
import {
  useRecentRecording,
  type RecentRecordingState,
} from '@/hooks/useRecentRecording';
import { useAppStore } from '@/state/store';
import { theme } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function HomeScreen() {
  const nav = useNavigation<ScreenProps<'Home'>['navigation']>();
  const recording = useRecording();
  const lastRecordingId = useAppStore((s) => s.lastRecordingId);
  const setLastRecordingId = useAppStore((s) => s.setLastRecordingId);
  const recent = useRecentRecording(lastRecordingId);

  async function handleRecordPress() {
    if (recording.isRecording) {
      const id = await recording.stopAndUpload();
      if (id) setLastRecordingId(id);
    } else {
      await recording.start();
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.brand}>Mindify</Text>
        <Pressable onPress={() => nav.navigate('Brain')} hitSlop={16}>
          <Text style={styles.brainLink}>The Brain →</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        {(recording.isRecording || recording.isUploading) && (
          <Text style={styles.timer}>{formatElapsed(recording.elapsedMs)}</Text>
        )}
        {recording.isRecording && (
          <View style={styles.waveformWrap}>
            <RecordingWaveform meterDb={recording.meterDb} />
          </View>
        )}
        <View style={{ height: theme.spacing.xl }} />
        <RecordButton
          isRecording={recording.isRecording}
          isUploading={recording.isUploading}
          onPress={handleRecordPress}
        />
        {recording.error && (
          <Text style={styles.error}>{recording.error}</Text>
        )}
      </View>

      <NextActionCard />
      <RecentStatus
        recordingId={lastRecordingId}
        recent={recent}
        onView={() => nav.navigate('Brain')}
      />
    </ScreenContainer>
  );
}

function RecentStatus({
  recordingId,
  recent,
  onView,
}: {
  recordingId: string | null;
  recent: RecentRecordingState;
  onView: () => void;
}) {
  if (!recordingId) return <View style={styles.statusPlaceholder} />;
  if (recent.processing) {
    return (
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          Processing your recording...
        </Text>
      </View>
    );
  }
  if (recent.itemCount === 0) {
    return (
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          No items captured. Want to try again?
        </Text>
      </View>
    );
  }
  return (
    <Pressable style={styles.statusBar} onPress={onView}>
      <Text style={styles.statusText}>
        {recent.itemCount} item{recent.itemCount === 1 ? '' : 's'} captured
        {'  →  '}view brain
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  brand: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  brainLink: {
    fontSize: theme.fontSize.md,
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.medium,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  timer: {
    fontSize: theme.fontSize.xxl,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.regular,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
    marginBottom: theme.spacing.lg,
  },
  waveformWrap: { marginBottom: theme.spacing.md },
  error: {
    marginTop: theme.spacing.lg,
    fontSize: theme.fontSize.sm,
    color: theme.colors.record,
    paddingHorizontal: theme.spacing.lg,
    textAlign: 'center',
  },
  statusPlaceholder: { height: 64 },
  statusBar: {
    height: 64,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
  },
});
