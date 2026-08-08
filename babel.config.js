module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      // `jsxImportSource: "nativewind"` is what lets `className` work on RN components.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // babel-preset-expo (SDK 54+) injects the react-native-worklets plugin that
    // Reanimated 4 needs, so it must not be listed again here.
  };
};
