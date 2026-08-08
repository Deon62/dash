const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // NativeWind defaults this to the bare string "tailwind.config" and resolves
  // it against process.cwd(). On a cold build (`--clear`) that resolved against
  // a package inside node_modules instead of the project root and the build
  // died with a misleading ESM error. An absolute path removes the ambiguity.
  configPath: path.resolve(__dirname, "tailwind.config.js"),
});
