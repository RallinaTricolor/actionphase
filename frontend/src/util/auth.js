export function accessToken(state) {
    if (state.auth.access) {
        return state.auth.access.token;
    }
}

export function isAccessTokenExpired(state) {
  if (state.auth.access && state.auth.access.exp) {
    return 1000 * state.auth.access.exp - (new Date()).getTime() < (1000 * 60 * 60 * 24); // Refresh token if less than one day remaining
  }
}

export function isAuthenticated(state) {
  return state.auth.access && !isAccessTokenExpired(state);
}

export function authErrors(state) {
   return state.auth.errors;
}