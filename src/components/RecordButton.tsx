import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

const SIZE = 220;

/**
 * Oversized record CTA — the home screen's primary action per the plan.
 * Pulses while recording, dims while uploading.
 */
export function RecordButton({
  isRecording,
  isUploading,
  onPress,
}: {
  isRecording: boolean;
  isUploading: boolean;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  const label = isUploading
    ? 'Uploading...'
    : isRecording
      ? 'Tap to stop'
      : 'Hold a thought';
  const color = isRecording ? theme.colors.recordActive : theme.colors.record;

  return (
    <Pressable
      disabled={isUploading}
      onPress={onPress}
      hitSlop={20}
      style={styles.wrapper}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: color,
            transform: [{ scale: pulse }],
            opacity: isUploading ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.inner}>
          {isRecording ? (
            <View style={styles.stopSquare} />
          ) : (
            <View style={styles.recordDot} />
          )}
        </View>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  inner: {
    width: SIZE - 32,
    height: SIZE - 32,
    borderRadius: (SIZE - 32) / 2,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  stopSquare: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  label: {
    marginTop: theme.spacing.lg,
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
  },
});
