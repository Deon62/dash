/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          white: "#FFFFFF",
          // Pure white canvas — glass surfaces need a clean ground to sit on,
          // an off-white makes the frosted panels read as dirty grey.
          canvas: "#FFFFFF",
          black: "#09090B",
          slate: "#52525B",
          muted: "#A1A1AA",
          border: "#E5E7EB",
          // Hairline used on glass, where a solid border is too heavy.
          hairline: "#EFEFF2",
        },
        transit: {
          // Matatu — yellow / amber
          matatu: "#FFB800",
          "matatu-bg": "#FFFBEB",
          "matatu-border": "#FDE68A",
          // Boda Boda — coral / red
          boda: "#FF3B30",
          "boda-bg": "#FEF2F2",
          "boda-border": "#FECACA",
          // Tuk-Tuk — electric teal / cyan
          tuktuk: "#00C7BE",
          "tuktuk-bg": "#ECFEFF",
          "tuktuk-border": "#A5F3FC",
          // Everything else — slate
          other: "#64748B",
          "other-bg": "#F8FAFC",
          "other-border": "#E2E8F0",
        },
      },
      // React Native has no synthetic font weights: every weight is its own
      // family, so these are named `jk-*` to avoid colliding with Tailwind's
      // own `font-bold` / `font-semibold` fontWeight utilities.
      fontFamily: {
        jk: ["PlusJakartaSans_400Regular"],
        "jk-semi": ["PlusJakartaSans_600SemiBold"],
        "jk-bold": ["PlusJakartaSans_700Bold"],
        "jk-black": ["PlusJakartaSans_800ExtraBold"],
      },
    },
  },
  plugins: [],
};
