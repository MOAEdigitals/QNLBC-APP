import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qnlbc.churchapp',
  appName: 'QNLBC App',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SystemBars: { style: 'DARK', insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#020617',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#020617',
    },
  },
};

export default config;
