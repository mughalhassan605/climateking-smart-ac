// Design tokens recovered from the original 1.2.2 build (theme modules 519–529).
// Keep values identical so the rebuild renders the same as the shipped app.

export const palette = {
  neutral0: '#FFFFFF',
  neutral50: '#F4F6F8',
  neutral100: '#ECEFF1',
  neutral200: '#CFD8DC',
  neutral300: '#B0BEC5',
  neutral400: '#90A4AE',
  neutral500: '#78909C',
  neutral600: '#607D8B',
  neutral700: '#455A64',
  neutral800: '#37474F',
  neutral900: '#263238',
  neutral950: '#161E22',
  brand50: '#FEF6EA',
  brand100: '#FDE8C6',
  brand200: '#FBD79B',
  brand300: '#F8C46B',
  brand400: '#F5B249',
  brand500: '#F3A034',
  brand600: '#DC8A24',
  brand700: '#B5701B',
  brand800: '#8C5616',
  brand900: '#5E3A12',
  green50: '#E8F5E9',
  green100: '#C8E6C9',
  green200: '#A5D6A7',
  green300: '#81C784',
  green400: '#66BB6A',
  green500: '#4CAF50',
  green600: '#43A047',
  green700: '#388E3C',
  green800: '#2E7D32',
  green900: '#1B5E20',
  cool: '#2196F3',
  heat: '#FB8C00',
  dry: '#26A69A',
  fan: '#78909C',
  auto: '#7E57C2',
  success: '#4CAF50',
  successDark: '#43A047',
  warning: '#FF9800',
  warningDark: '#FB8C00',
  danger: '#E53935',
  dangerDark: '#C62828',
  info: '#0090E3',
  black: '#000000',
  white: '#FFFFFF',
  overlayLight: 'rgba(38, 50, 56, 0.45)',
  overlayDark: 'rgba(0, 0, 0, 0.6)',
};

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xl2: 24,
  xl3: 32,
  xl4: 40,
  xl5: 48,
  xl6: 64,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xl2: 24,
  xl3: 32,
  pill: 999,
  full: 9999,
} as const;

// The original asks for 'Anta' but ships the file as Anta-Regular.ttf, which Android never
// resolves. React Native then falls back to the system font and only honours bold (700),
// so 500/600 render as regular. Keeping the same family name (with no font linked)
// reproduces exactly what users of 1.2.2 see.
const fontFamilies = {
  display: 'Anta',
  heading: 'Anta',
  numeric: 'Anta',
  body: 'Anta',
  mono: 'monospace',
} as const;

const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const typography = {
  families: fontFamilies,
  weights: fontWeights,
  sizes: { xs: 11, sm: 12, md: 14, base: 16, lg: 18, xl: 22, xl2: 28, xl3: 34, xl4: 44 },
  variants: {
    displayLg: { fontFamily: fontFamilies.display, fontSize: 44, lineHeight: 50, fontWeight: fontWeights.bold, letterSpacing: -0.5 },
    display: { fontFamily: fontFamilies.display, fontSize: 34, lineHeight: 40, fontWeight: fontWeights.bold, letterSpacing: -0.4 },
    titleLg: { fontFamily: fontFamilies.heading, fontSize: 28, lineHeight: 34, fontWeight: fontWeights.semibold, letterSpacing: -0.3 },
    title: { fontFamily: fontFamilies.heading, fontSize: 22, lineHeight: 28, fontWeight: fontWeights.semibold, letterSpacing: -0.2 },
    heading: { fontFamily: fontFamilies.heading, fontSize: 18, lineHeight: 24, fontWeight: fontWeights.semibold },
    numeric: { fontFamily: fontFamilies.numeric, fontSize: 44, lineHeight: 50, fontWeight: fontWeights.regular, letterSpacing: -1 },
    body: { fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 22, fontWeight: fontWeights.regular },
    bodySm: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 20, fontWeight: fontWeights.regular },
    label: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 18, fontWeight: fontWeights.medium },
    caption: { fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 16, fontWeight: fontWeights.regular },
    overline: {
      fontFamily: fontFamilies.body,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: fontWeights.medium,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
  },
} as const;

export const shadows = {
  none: { boxShadow: [] },
  sm: { boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 6, color: 'rgba(11, 15, 19, 0.06)' }] },
  md: { boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 14, color: 'rgba(11, 15, 19, 0.1)' }] },
  lg: { boxShadow: [{ offsetX: 0, offsetY: 12, blurRadius: 24, color: 'rgba(11, 15, 19, 0.14)' }] },
} as const;

export const motion = {
  duration: { instant: 80, fast: 160, base: 240, slow: 360, slowest: 520 },
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0, 0, 0, 1],
    accelerate: [0.3, 0, 1, 1],
    emphasized: [0.2, 0, 0, 1],
  },
  spring: {
    soft: { damping: 18, stiffness: 160, mass: 1 },
    snappy: { damping: 22, stiffness: 280, mass: 1 },
    bouncy: { damping: 12, stiffness: 200, mass: 1 },
  },
  stagger: { step: 48, max: 6 },
} as const;

export const sharedTokens = { spacing, radius, fonts: fontFamilies, typography, shadows, motion };
