// Native modules have no JS fallback under Jest; mocks for them live here.
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
require('react-native-unistyles/mocks');
require('./src/theme/unistyles');
jest.mock('react-native-udp', () => ({ createSocket: jest.fn() }));
jest.mock('react-native-quick-crypto', () => ({}));
