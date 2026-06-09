import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';

export default function RootLayout() {
  useEffect(() => {
    // Default to portrait for pre-login screens (index, login)
    async function lockOrientation() {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
    lockOrientation();
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar hidden={true} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />       {/* 1. Landing */}
        <Stack.Screen name="login" />       {/* 2. Login */}
        <Stack.Screen name="connection" />  {/* 3. Connection */}
        <Stack.Screen name="dashboard" />   {/* 4. Dashboard */}
        <Stack.Screen name="module" />      {/* 5. Camera/Run */}
      </Stack>
    </ThemeProvider>
  );
}