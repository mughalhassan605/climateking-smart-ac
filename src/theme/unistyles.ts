import { StyleSheet } from 'react-native-unistyles';
import { darkTheme, lightTheme } from './themes';

const breakpoints = { xs: 0, sm: 360, md: 480, lg: 768, xl: 1024 } as const;

type AppThemes = { light: typeof lightTheme; dark: typeof darkTheme };
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: { light: lightTheme, dark: darkTheme },
  breakpoints,
  settings: { adaptiveThemes: true },
});
