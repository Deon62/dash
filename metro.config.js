const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/**
 * Metro swallows whatever goes wrong in here, so say it out loud first.
 *
 * `metro-config`'s loader does `require(configPath)`, and on *any* throw it
 * retries with `await import(configPath)`. On Windows that second attempt fails
 * on the absolute path alone — "Only URLs with a scheme in: file, data, and
 * node are supported... Received protocol 'c:'" — and that message replaces the
 * real one. The result is a build that dies pointing at the platform instead of
 * at the missing package that actually caused it.
 *
 * Printing before throwing is the way round it: the explanation is already on
 * the terminal by the time Metro overwrites the exception.
 */
function required(request, because) {
  try {
    return require.resolve(request);
  } catch {
    console.error(
      `\n[metro.config.js] Cannot resolve "${request}".\n` +
        `  ${because}\n` +
        "  Most likely node_modules is incomplete or was installed without dev\n" +
        "  dependencies. Run `npm install` and build again.\n" +
        "  (Metro is about to report a Windows/ESM path error instead of this\n" +
        "  one — ignore it and fix the line above.)\n",
    );
    throw new Error(`metro.config.js: missing "${request}"`);
  }
}

const config = getDefaultConfig(__dirname);

// Let `import Art from "./x.svg"` return a component instead of an asset URI.
// NativeWind does not claim the babel-transformer slot, so the two compose.
config.transformer.babelTransformerPath = required(
  "react-native-svg-transformer/expo",
  "SVG imports (src/components/Glyph.jsx) compile through it, so the app cannot build without it.",
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg",
);
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // NativeWind defaults this to the bare string "tailwind.config" and resolves
  // it against process.cwd(). On a cold build that can resolve against the
  // wrong directory; an absolute path removes the ambiguity.
  configPath: path.resolve(__dirname, "tailwind.config.js"),
});
