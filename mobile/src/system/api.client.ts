import unboundedApi from '../api/sdk';
import { authStorage } from '../pages/login/save.tokens';

/* The default is the shared backend every worktree can borrow. A worktree
   running its own, or serving the installed app over the LAN, sets
   VITE_API_HOST in `mobile/.env.local` — see docs/running.md. */
const API_HOST = import.meta.env.VITE_API_HOST ?? 'http://localhost:3001';

export const apiClient = unboundedApi.functional;

export const getConnection = () => ({
  host: API_HOST,
  fetch: authenticatedFetch,
});

/** For signing in and signing up, which have no session yet. */
export const getPublicConnection = () => ({ host: API_HOST });

export const isAuthenticated = async () =>
  Boolean(await authStorage.getAccessToken());

// Never redirect away from these: it would interrupt someone signing in.
const AUTH_SCREENS = ['/login', '/register'];

const redirectToLogin = async () => {
  await authStorage.clearTokens?.();

  if (!AUTH_SCREENS.includes(window.location.pathname)) {
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
  const accessToken = await authStorage.getAccessToken();

  /* No token, no request. The redirect still happens: nothing else guards the
     routes, so without it a signed-out user sits on a page that loads nothing. */
  if (!accessToken) {
    await redirectToLogin();
    throw new Error('Not signed in');
  }

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
