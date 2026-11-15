import { readFileSync } from 'fs';
import { CapacitorConfig } from '@capacitor/cli';

/* The installed app bundles its own JS and needs no server. A live-reload
   build is the exception: its webview loads a dev server over the LAN at
   launch, so that case needs the machine's address, read rather than written
   down because the IP changes with the network. See docs/running.md.

   Live reload is opt-IN, and the direction matters. A release build that kept a
   LAN address would launch blank on every tester's phone with nothing on screen
   to say why — so forgetting the flag gives a working release, not a broken
   one. `npm run ios:dev` sets it; nothing else does.

   Port 5173 is fixed on purpose. Only one worktree can hold the installed app,
   and holding it means serving 5173. */
const liveReload = process.env.CAP_LIVE_RELOAD === '1';
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
  ...(liveReload
    ? {
        server: {
          url: `http://${lanIp()}:${DEVICE_PORT}`,
          cleartext: true,
        },
      }
    : {}),
  ios: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
