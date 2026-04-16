import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { ScreenContainer } from '@/components/ScreenContainer';
import { theme } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

const ONBOARDING_KEY = 'mindify.onboardedAt';

export function OnboardingScreen() {
  const nav = useNavigation<ScreenProps<'Onboarding'>['navigation']>();
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  async function handleStart() {
    setRequesting(true);
    setDenied(false);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setDenied(true);
        return;
      }
      await AsyncStorage.setItem(ONBOARDING_KEY, new Date().toISOString());
      nav.reset({ index: 0, routes: [{ name: 'Home' }] });
    } finally {
      setRequesting(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Hold the thought.</Text>
        <Text style={styles.body}>
          Mindify turns the loose thoughts in your head into organized items
          in your brain. Just talk — we&apos;ll do the sorting.
        </Text>

        <View style={styles.steps}>
          <Step n={1} text="Tap and speak whatever's on your mind." />
          <Step n={2} text="We transcribe and sort it into tasks, ideas, and projects." />
          <Step n={3} text="Find it neatly organized in The Brain." />
        </View>
      </View>

      <View style={styles.actions}>
        {denied && (
          <Text style={styles.deniedText}>
            Microphone access is required. Open Settings → Mindify →
            Microphone to enable it, then try again.
          </Text>
        )}
        <Pressable
          style={[styles.startButton, requesting && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={requesting}
        >
          <Text style={styles.startButtonText}>
            {requesting ? 'Requesting...' : 'Allow microphone & continue'}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.fontSize.display,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    letterSpacing: -1,
    marginBottom: theme.spacing.md,
  },
  body: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
    lineHeight: theme.fontSize.lg * 1.5,
    marginBottom: theme.spacing.xxl,
  },
  steps: { gap: theme.spacing.md },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  stepText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    lineHeight: theme.fontSize.md * 1.4,
  },
  actions: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  deniedText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.record,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  startButton: {
    backgroundColor: theme.colors.text,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  startButtonDisabled: { opacity: 0.6 },
  startButtonText: {
    color: '#ffffff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});
