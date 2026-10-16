const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Permettre la résolution des fichiers .wasm pour expo-sqlite sur le web
config.resolver.assetExts.push('wasm');

module.exports = config;
