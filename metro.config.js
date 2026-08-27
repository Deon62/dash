const path = require("path");

/**
 * Metro swallows whatever goes wrong in here, so say it out loud first.
 *
 * `metro-config`'s loader does `require(configPath)`, and on *any* throw it
 * retries with `await import(configPath)`. On Windows that second attempt fails
 * on the absolute path alone — "Only URLs with a scheme in: file, data, and
 * node are supported... Received protocol 'c:'" — and that message replaces the
 * real one. The result is a build that dies pointing at the platform instead of
 * at whatever actually broke.
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

/**
 * Anchor the working directory to the project root.
 *
 * NativeWind reaches `withCssInterop` → `expoColorSchemeWarning`, which calls
 * `getConfig(process.cwd())` with no way to pass a root in. Run the bundler
 * from anywhere but the project root and that throws `ConfigError: The
 * expected package.json path: <cwd>/package.json does not exist` — which Metro
 * then masks as the Windows/ESM error above, so the message names neither
 * NativeWind nor the directory you were standing in.
 *
 * It is not only a mistyped `cd`: Gradle-driven bundling runs Metro from the
 * `android` directory, so the same crash is reachable from a perfectly ordinary
 * build. This file only ever lives at the project root, so `__dirname` is the
 * authority on where that is.
 *
 * The function it is placating exists purely to warn when `userInterfaceStyle`
 * is unset — which this app sets. It throws before it can decide not to warn.
 */
if (process.cwd() !== __dirname) {
  process.chdir(__dirname);
}

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

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
  // Relative to the project root, which the chdir above guarantees.
  input: "./global.css",
  // NativeWind defaults this to the bare string "tailwind.config" and resolves
  // it against process.cwd(). An absolute path removes the ambiguity even if
  // something later moves the working directory again.
  configPath: path.resolve(__dirname, "tailwind.config.js"),
});
