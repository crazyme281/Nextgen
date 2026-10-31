import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nextgen.app',
  appName: 'Nextgen',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
