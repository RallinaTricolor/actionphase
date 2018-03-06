export function accessToken(state) {
    if (state.auth.access) {
        return state.access.token;
    }
}

export function isAccessTokenExpired(state) {
  if (state.auth.access && state.auth.access.exp) {
    return 1000 * state.auth.access.exp - (new Date()).getTime() < 5000;
  }
}

export function isAuthenticated(state) {
  return !isAccessTokenExpired(state);
}

export function authErrors(state) {
   return state.auth.errors;
}