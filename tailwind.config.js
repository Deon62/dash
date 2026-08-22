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
        /**
         * The brand. Every filled button, every active state, every
         * highlight — one blue doing all of it, always with white on top.
         * Nothing decorative is painted in it: if it is this colour, it is
         * something you can act on or something the app is telling you is on.
         */
        primary: "#007FFA",
        /* Activity marks. Only ever drawn as dots and legend swatches, and
           always from `src/theme/colors.js` — they are here so the names
           resolve if a class ever needs one. */
        pink: "#EC4899",
        violet: "#7C3AED",
        teal: "#0D9488",
        amber: "#F59E0B",
        danger: "#DC2626",
      },
      // React Native has no synthetic font weights: every weight is its own
      // family, so these are named `jk-*` to avoid colliding with Tailwind's
      // own fontWeight utilities. Body copy stays at 400/500 so the page reads
      // quiet; 700 is reserved for page titles, which are the one place the
      // type is meant to be loud.
      fontFamily: {
        jk: ["PlusJakartaSans_400Regular"],
        "jk-med": ["PlusJakartaSans_500Medium"],
        "jk-semi": ["PlusJakartaSans_600SemiBold"],
        "jk-bold": ["PlusJakartaSans_700Bold"],
      },
    },
  },
  plugins: [],
};
