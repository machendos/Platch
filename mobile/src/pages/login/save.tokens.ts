import { Preferences } from '@capacitor/preferences';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const authStorage = {
  async saveTokens(accessToken: string, refreshToken: string) {
    await Preferences.set({ key: ACCESS_TOKEN_KEY, value: accessToken });
    await Preferences.set({ key: REFRESH_TOKEN_KEY, value: refreshToken });
  },

  async getAccessToken() {
    const result = await Preferences.get({ key: ACCESS_TOKEN_KEY });

    return result.value;
  },

  async getRefreshToken() {
    const result = await Preferences.get({ key: REFRESH_TOKEN_KEY });
    return result.value;
  },

  async clearTokens() {
    await Preferences.remove({ key: ACCESS_TOKEN_KEY });
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  },
};
