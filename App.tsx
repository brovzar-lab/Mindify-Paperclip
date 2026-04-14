import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// WS2 placeholder — WS3 replaces with the Home/Brain/Detail navigation tree.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mindify</Text>
      <Text style={styles.subtitle}>Voice in. Organized out.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b6b6b',
  },
});
