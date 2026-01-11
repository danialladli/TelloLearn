import { Platform } from 'react-native';

// 1. Define the TelloLearn Brand Palette (Matches Web App)
const palette = {
  slate900: '#0f172a', // Main Background
  slate800: '#1e293b', // Cards, Inputs, Panels
  slate700: '#334155', // Borders
  slate400: '#94a3b8', // Secondary Text (Muted)
  slate50:  '#f8fafc', // Primary Text (White/Light)
  blue600:  '#2563eb', // Primary Brand Color
  green500: '#22c55e', // Success / Online
  red500:   '#ef4444', // Error / Offline
};

const tintColorLight = palette.blue600;
const tintColorDark = palette.blue600;

export const Colors = {
  // We keep 'light' for safety, but mapped to reasonable defaults
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    card: '#f8fafc',
    border: '#e2e8f0',
    success: palette.green500,
    error: palette.red500,
  },
  // This is the active theme for your "Dark Mode" app
  dark: {
    text: palette.slate50,        // #f8fafc
    background: palette.slate900, // #0f172a
    tint: tintColorDark,          // #2563eb
    icon: palette.slate400,       // #94a3b8
    tabIconDefault: palette.slate400,
    tabIconSelected: tintColorDark,
    
    // Custom UI Elements
    card: palette.slate800,       // #1e293b
    border: palette.slate700,     // #334155
    input: palette.slate800,      // #1e293b
    success: palette.green500,    // #22c55e
    error: palette.red500,        // #ef4444
    textSecondary: palette.slate400,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'Menlo', // Better for code snippets on iOS
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});