const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Let `import Art from "./x.svg"` return a component instead of an asset URI.
// NativeWind does not claim the babel-transformer slot, so the two compose.
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer/expo"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // NativeWind defaults this to the bare string "tailwind.config" and resolves
  // it against process.cwd(). On a cold build that can resolve against the
  // wrong directory; an absolute path removes the ambiguity.
  configPath: path.resolve(__dirname, "tailwind.config.js"),
});
