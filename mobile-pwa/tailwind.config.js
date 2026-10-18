/** Swiss architectural design tokens for Mail HQ (compiled to public/tailwind.css) */
module.exports = {
  content: ['./public/index.html', './public/app.js'],
  theme: {
    extend: {
      colors: {
        paper: '#FBFBF9',
        paperMuted: '#F3F3EF',
        surface: '#FFFFFF',
        ink: '#111111',
        slateMuted: '#555555',
        slateLight: '#888884',
        hairline: '#E2E2DF',
        intlOrange: '#D9381E',
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
};
