import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import { SCANNER_MODE } from './src/devtools/scannerMode';

// Prevent uncaught JS exceptions from terminating the app
if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.warn('Global Error Handler caught:', error?.message);
    try {
      const { logger } = require('./src/lib/logger');
      logger.logError('UNHANDLED_EXCEPTION', error?.message || 'Uncaught exception', undefined, undefined, {
        stack: error?.stack,
        isFatal,
      });
    } catch {}
    if (!isFatal && defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

if (SCANNER_MODE) {
  // Standalone diagnostic build — no theme/navigation, just the Wi-Fi scanner.
  const ScannerApp = require('./src/devtools/ScannerApp').default;
  AppRegistry.registerComponent(appName, () => ScannerApp);
} else {
  require('./src/theme/unistyles');
  const App = require('./App').default;
  AppRegistry.registerComponent(appName, () => App);
}
