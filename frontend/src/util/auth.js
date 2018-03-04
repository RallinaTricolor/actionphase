export function accessToken(state) {
    if (state.access) {
        return state.access.token;
    }
}

export function isAccessTokenExpired(state) {
  if (state.access && state.access.exp) {
    return 1000 * state.access.exp - (new Date()).getTime() < 5000;
  }
  return true;
}

export function isAuthenticated(state) {
  return !isAccessTokenExpired(state);
}

export function authErrors(state) {
   return state.errors;
}