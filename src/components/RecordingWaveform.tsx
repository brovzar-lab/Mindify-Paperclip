import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

const BARS = 30;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 56;

/**
 * Cheap rolling waveform: each bar holds an Animated.Value, and we advance
 * a circular index on each new metering reading. Heights animate between
 * samples for a smooth visual at the 12 fps that expo-av's metering update
 * interval gives us.
 */
export function RecordingWaveform({ meterDb }: { meterDb: number }) {
  const valuesRef = useRef<Animated.Value[]>(
    Array.from({ length: BARS }, () => new Animated.Value(MIN_HEIGHT)),
  );
  const indexRef = useRef(0);

  useEffect(() => {
    const idx = indexRef.current % BARS;
    // dB range [-60, 0] → bar height. Anything quieter than -60 dB is silence.
    const normalized = Math.max(0, Math.min(1, (meterDb + 60) / 60));
    const target = MIN_HEIGHT + normalized * (MAX_HEIGHT - MIN_HEIGHT);
    Animated.timing(valuesRef.current[idx], {
      toValue: target,
      duration: 80,
      useNativeDriver: false,
    }).start();
    indexRef.current = (idx + 1) % BARS;
  }, [meterDb]);

  return (
    <View style={styles.row}>
      {valuesRef.current.map((v, i) => (
        <Animated.View key={i} style={[styles.bar, { height: v }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MAX_HEIGHT,
    gap: 3,
  },
  bar: {
    width: 4,
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
  },
});
