/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        faso: {
          // Drapeau burkinabe : rouge, vert, etoile jaune.
          red: "#EF3340",
          green: "#12A24A",
          gold: "#FCD116",
          ink: "#0B0D10",
          panel: "#14181D",
          line: "#232A32",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        equalize: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        equalize: "equalize 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
