import {refreshAccessToken} from '../actions/auth'
import * as auth from '../util/auth'
import {TOKEN_REQUEST} from '../actions/auth'

export const jwt = store => next => action => {
    const state = store.getState();
    if (action.type !== TOKEN_REQUEST && !state.fetching && auth.isAccessTokenExpired(state)) {
        store.dispatch(refreshAccessToken(auth.accessToken(state)));
    }
    return next(action);
};
