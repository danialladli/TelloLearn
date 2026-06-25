import { Stack, usePathname } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { ApiProvider } from '@/utils/apiConfig';
// Screens that stay in portrait — everything else locks to landscape
const PORTRAIT_ROUTES = new Set(['/', '/index', '/login']);

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    if (PORTRAIT_ROUTES.has(pathname)) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  }, [pathname]);

  return (
    <ApiProvider>
      <ThemeProvider value={DarkTheme}>
        <StatusBar hidden={true} />
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="module" />
        </Stack>
      </ThemeProvider>
    </ApiProvider>
  );
}
