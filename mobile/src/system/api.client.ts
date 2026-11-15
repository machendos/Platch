import unboundedApi from '../api/sdk';
import { authStorage } from '../pages/login/save.tokens';

/* Anything served by Vite — a browser, simulator Safari, the installed app —
   calls the backend same-origin through the dev proxy, because a direct call to
   VITE_API_HOST is killed by ad-blocking extensions before it is sent and
   Chrome records no request at all. A built bundle has no Vite in front of it
   and calls the host directly; the default there is the shared backend every
   worktree can borrow. See docs/running.md.

   The origin is spelled out rather than left bare: @nestia/fetcher builds
   `new URL(host + path)`, which throws on a host that is not absolute. */
const productionHost = () => {
  const host = import.meta.env.VITE_API_HOST;
  /* Loudly, at startup, rather than silently falling back to localhost — which
     on a phone is the phone, so every request fails and the app looks broken
     with nothing to say why. A build that cannot name its backend must not
     reach a tester. Set it in mobile/.env.production. */
  if (!host)
    throw new Error(
      'VITE_API_HOST is not set. A production build has no backend to reach — ' +
        'put the deployed API URL in mobile/.env.production.',
    );
  return host;
};

const API_HOST = import.meta.env.DEV
  ? `${window.location.origin}/api`
  : productionHost();

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

  return responseRepeat;
};
