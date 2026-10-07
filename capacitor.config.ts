import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qnlbc.churchapp',
  appName: 'QNLBC App',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#071124',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
