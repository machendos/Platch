import unboundedApi from '../api';
import { authStorage } from './save.tokens';

// const API_HOST = 'https://platch.machekhin.com';

const API_HOST = 'http://192.168.1.128:3001';

export const apiClient = unboundedApi.functional;

export const getConnection = () => ({
  host: API_HOST,
  fetch: authenticatedFetch,
});

const redirectToLogin = async () => {
  await authStorage.clearTokens?.();

  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
};

const mixTokenToHeaders = (init: RequestInit | undefined, token: string) => {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async () => {
  const refreshToken = await authStorage.getRefreshToken();

  if (!refreshToken) {
    await redirectToLogin();
    return null;
  }

  try {
    const { accessToken, refreshToken: refreshTokenNew } =
      await apiClient.auth.refresh_token.refreshToken({
        host: API_HOST,
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

    await authStorage.saveTokens(accessToken, refreshTokenNew);

    return accessToken;
  } catch {
    await redirectToLogin();
    return null;
  }
};

const getRefreshedAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const authenticatedFetch: typeof fetch = async (input, init) => {
  console.log({ input, init });

  const accessToken = (await authStorage.getAccessToken()) ?? '';

  const headers = mixTokenToHeaders(init, accessToken);
  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401) return response;

  const newAccessToken = await getRefreshedAccessToken();

  if (!newAccessToken) {
    await redirectToLogin();
    return new Response(null, { status: 401 });
  }

  const headersRepeat = mixTokenToHeaders(init, newAccessToken);
  const responseRepeat = await fetch(input, {
    ...init,
    headers: headersRepeat,
  });

  if (responseRepeat.status === 401) {
    await redirectToLogin();
  }

  return response;
};
