export function accessToken(state) {
    if (state.access) {
        return state.access.token;
    }
}

export function refreshToken(state) {
    if (state.refresh) {
        return state.refresh.token;
    }
}

export function isAccessTokenExpired(state) {
  if (state.access && state.access.exp) {
    return 1000 * state.access.exp - (new Date()).getTime() < 5000;
  }
  return true;
}

export function isRefreshTokenExpired(state) {
  if (state.refresh && state.refresh.exp) {
    return 1000 * state.refresh.exp - (new Date()).getTime() < 5000;
  }
  return true;
}

export function isAuthenticated(state) {
  return !isRefreshTokenExpired(state);
}

export function authErrors(state) {
   return state.errors;
}