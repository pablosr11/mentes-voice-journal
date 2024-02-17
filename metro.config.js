// following https://docs.expo.dev/guides/using-firebase/ to add firebase to the project
// 16/02/24
const { getDefaultConfig } = require("@expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);
defaultConfig.resolver.sourceExts.push("cjs");

module.exports = defaultConfig;
