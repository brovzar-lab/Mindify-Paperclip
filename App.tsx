import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthGate } from '@/components/AuthGate';
import { RootStack } from '@/navigation/RootStack';
import {
  configureNotificationHandler,
  installNotificationResponseListener,
} from '@/lib/notifications';
import { theme } from '@/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.accent,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.divider,
    notification: theme.colors.urgencyHigh,
  },
};

export default function App() {
  useEffect(() => {
    configureNotificationHandler();
    const unsub = installNotificationResponseListener();
    return unsub;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <AuthGate>
            <RootStack />
          </AuthGate>
        </NavigationContainer>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
