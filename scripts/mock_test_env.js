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

const memoryStore = new Map();

const mockAsyncStorage = {
  getItem: async (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
  setItem: async (key, value) => {
    memoryStore.set(key, String(value));
  },
  removeItem: async (key) => {
    memoryStore.delete(key);
  },
  clear: async () => {
    memoryStore.clear();
  },
  getAllKeys: async () => Array.from(memoryStore.keys()),
};

const mockDb = {
  execAsync: async () => {},
  runAsync: async () => ({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  withTransactionAsync: async (cb) => cb(),
  isInTransactionAsync: async () => false,
};

const openDatabaseAsync = async () => mockDb;

const env = {
  Platform: { OS: 'web' },
  StyleSheet: { create: (s) => s },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Alert: { alert: () => {} },
  openDatabaseAsync,
  ...mockAsyncStorage,
  default: mockAsyncStorage,
};

module.exports = env;
