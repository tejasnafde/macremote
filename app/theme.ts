// Design tokens ported 1:1 from design/mockups/deck.html's `:root` CSS
// variables (the user-approved "Deck" mockup, 3 feedback rounds). Keep this
// file as the single source of truth for color/type/radius/motion so screens
// never hardcode a hex value.
export const colors = {
  ink950: '#0B0E12',
  ink900: '#10141A',
  ink850: '#131820',
  ink800: '#171D26',
  ink700: '#1E2530',
  ink600: '#2A323E',
  ink500: '#3A4451',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.15)',
  off: '#F3F5F1',
  off72: 'rgba(243,245,241,0.72)',
  off55: 'rgba(243,245,241,0.55)',
  off38: 'rgba(243,245,241,0.36)',
  off18: 'rgba(243,245,241,0.14)',
  green: '#4ADE80',
  greenStrong: '#7BEDAA',
  greenInk: '#04140B',
  green14: 'rgba(74,222,128,0.14)',
  green24: 'rgba(74,222,128,0.24)',
  ember: '#F2795B',
  ember16: 'rgba(242,121,91,0.16)',
} as const;

export const radii = {
  xl: 32,
  lg: 24,
  md: 16,
  sm: 11,
  full: 999,
} as const;

// @expo-google-fonts/familjen-grotesk only ships static weights up to 700
// (Bold) — the mockup's CSS also reaches for 800 in a couple of spots
// (device name, now-playing title). We fall back to 700 there; noted in the
// P7 status writeup rather than pulling in a variable-font loader for one
// weight step.
export const fonts = {
  display: 'ArchivoBlack_400Regular',
  body: 'FamiljenGrotesk_400Regular',
  medium: 'FamiljenGrotesk_500Medium',
  semiBold: 'FamiljenGrotesk_600SemiBold',
  bold: 'FamiljenGrotesk_700Bold',
  extraBold: 'FamiljenGrotesk_700Bold', // stand-in for missing 800 weight
} as const;

export const fontModules = {
  ArchivoBlack_400Regular: require('@expo-google-fonts/archivo-black').ArchivoBlack_400Regular,
  FamiljenGrotesk_400Regular:
    require('@expo-google-fonts/familjen-grotesk').FamiljenGrotesk_400Regular,
  FamiljenGrotesk_500Medium:
    require('@expo-google-fonts/familjen-grotesk').FamiljenGrotesk_500Medium,
  FamiljenGrotesk_600SemiBold:
    require('@expo-google-fonts/familjen-grotesk').FamiljenGrotesk_600SemiBold,
  FamiljenGrotesk_700Bold: require('@expo-google-fonts/familjen-grotesk').FamiljenGrotesk_700Bold,
};

// cubic-bezier(.2,0,0,1) / cubic-bezier(.33,0,.2,1) from the mockup's
// --ease / --ease-soft custom properties.
export const easingCurves = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  soft: [0.33, 0, 0.2, 1] as [number, number, number, number],
};

export const durations = {
  press: 150,
  fast: 180,
  base: 250,
  soft: 350,
  sheet: 420,
  lock: 650,
};

// Right-edge volume rail footprint: 10px edge offset + 58px rail + 6px
// gutter, from the mockup's --rail-w. Banners/hero cards pad their right
// edge by this much so they never run under the rail.
export const railWidth = 74;

export const spacing = {
  screenX: 18,
  setupX: 26,
  gap: 10,
};

export const pressScale = 0.96;
