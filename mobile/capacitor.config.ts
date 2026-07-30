import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.machekhin.platch',
  appName: 'Platch',
  webDir: 'dist',
  server: {
    url: 'http://192.168.1.128:5173',
    cleartext: true,
  },
  ios: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
