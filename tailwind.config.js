/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        /** Page ground. Everything sits on white. */
        canvas: "#FFFFFF",
        /** Cards, wells, inactive chips — the only fill besides white. */
        surface: "#F4F4F5",
        /** Every border and divider on the page. */
        line: "#E4E4E7",
        /** Primary text. */
        ink: "#09090B",
        /** Secondary text, placeholders, inactive glyphs. */
        muted: "#71717A",
        /** Filled buttons, active chips, the tab bar's selected state. */
        obsidian: "#18181B",
        /**
         * Reserved for interactive highlight only — a focused field, a live
         * class, the send button once it is armed. Never decoration: the
         * moment it is used for a heading it stops meaning "you can act here".
         */
        indigo: "#4F46E5",
        danger: "#DC2626",
      },
      // React Native has no synthetic font weights: every weight is its own
      // family, so these are named `jk-*` to avoid colliding with Tailwind's
      // own fontWeight utilities. Nothing above 600 — the type is meant to
      // read as quiet and even, and a heavier face undoes that on its own.
      fontFamily: {
        jk: ["PlusJakartaSans_400Regular"],
        "jk-med": ["PlusJakartaSans_500Medium"],
        "jk-semi": ["PlusJakartaSans_600SemiBold"],
      },
    },
  },
  plugins: [],
};
