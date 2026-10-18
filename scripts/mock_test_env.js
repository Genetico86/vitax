/**
 * Mocks légers pour les modules React Native / SQLite lors des tests Node.js
 */
const Module = require('module');
const origResolve = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  if (
    request === 'react-native' ||
    request === 'expo-sqlite' ||
    request === 'expo-modules-core' ||
    request.startsWith('expo-') ||
    request === '@react-native-async-storage/async-storage'
  ) {
    return require.resolve('./mock_test_env.js');
  }
  return origResolve.call(this, request, parent, isMain, options);
};

module.exports = {
  Platform: { OS: 'web' },
  StyleSheet: { create: (s) => s },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Alert: { alert: () => {} },
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};
