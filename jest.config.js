module.exports = {
  preset: '@react-native/jest-preset',
  // supabase/functions runs on Deno (tested with node --test) and bridge/ is Python (pytest).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/supabase/', '<rootDir>/bridge/'],
};
