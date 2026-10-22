module.exports = {
  preset: '@react-native/jest-preset',
  // supabase/functions runs on Deno (tested with node --test) and bridge/ is Python (pytest).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/supabase/', '<rootDir>/bridge/'],
  // These packages ship untranspiled ES modules; let Babel handle them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@shopify|react-native-.*|@craftzdog|@supabase|isows|@tanstack)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
