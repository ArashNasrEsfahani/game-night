import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the Vite PWA build (dist/) into a native Android app.
// Build flow:  npm run build  →  npx cap sync  →  open android/ in Android Studio.
const config: CapacitorConfig = {
  appId: 'com.gamenight.party',
  appName: 'Game Night',
  webDir: 'dist',
  backgroundColor: '#0f0d17',
  android: {
    // Content edits & game state persist in IndexedDB; keep it on the local app scheme.
    allowMixedContent: false,
  },
};

export default config;
