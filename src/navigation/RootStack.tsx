import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Loading } from '@/components/Loading';
import { HomeScreen } from '@/screens/HomeScreen';
import { BrainScreen } from '@/screens/BrainScreen';
import { ItemDetailScreen } from '@/screens/ItemDetailScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { TopicsScreen } from '@/screens/TopicsScreen';
import { TopicDetailScreen } from '@/screens/TopicDetailScreen';
import type { RootStackParamList } from './types';

const ONBOARDING_KEY = 'mindify.onboardedAt';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Decides initial route based on whether onboarding has run before. We don't
 * use a separate "splash" screen — the AuthGate above us already shows a
 * Loading state while anon-auth completes.
 */
export function RootStack() {
  const [initial, setInitial] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setInitial(v ? 'Home' : 'Onboarding'))
      .catch(() => setInitial('Onboarding'));
  }, []);

  if (!initial) return <Loading />;

  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Brain" component={BrainScreen} />
      <Stack.Screen name="Topics" component={TopicsScreen} />
      <Stack.Screen
        name="TopicDetail"
        component={TopicDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
