import { readFileSync } from 'fs';
import { CapacitorConfig } from '@capacitor/cli';

/* The installed app bundles no JS — its webview loads a dev server over the
   LAN at launch, so this file needs the machine's address. It is read rather
   than written down: the IP changes with the network, and a stale one makes
   the app open blank with nothing on screen to say why. See docs/running.md.

   Port 5173 is fixed on purpose. Only one worktree can hold the installed app,
   and holding it means serving 5173. */
const DEVICE_PORT = 5173;

const lanIp = (): string => {
  if (process.env.DEV_LAN_IP) return process.env.DEV_LAN_IP;

  const fromEnvFile = (() => {
    try {
      return readFileSync('.env.local', 'utf8')
        .split('\n')
        .find((line) => line.startsWith('DEV_LAN_IP='))
        ?.slice('DEV_LAN_IP='.length)
        .trim();
    } catch {
      return undefined;
    }
  })();

  if (fromEnvFile) return fromEnvFile;

  throw new Error(
    'DEV_LAN_IP is not set. Put it in mobile/.env.local (see docs/running.md) — ' +
      'the installed app cannot reach localhost.',
  );
};

const config: CapacitorConfig = {
  appId: 'com.machekhin.platch',
  appName: 'Platch',
  webDir: 'dist',
  server: {
    url: `http://${lanIp()}:${DEVICE_PORT}`,
    cleartext: true,
  },
  ios: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
