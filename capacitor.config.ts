import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medwatch.ai',
  appName: 'MedWatch AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
