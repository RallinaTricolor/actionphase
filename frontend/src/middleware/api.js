import {isRSAA, apiMiddleware} from 'redux-api-middleware';
import {refreshAccessToken} from '../actions/auth'
import * as auth from 'app/util/auth'
import {TOKEN_RECEIVED, LOGIN_SUCCESS} from 'app/actions/auth'

export function createApiMiddleware() {
    let postponedRSAAs = [];
    return ({dispatch, getState}) => {
        const rsaaMiddleware = apiMiddleware({dispatch, getState});
        return (next) => (action) => {
            const nextCheckPostoned = (nextAction) => {
                // Run postponed actions after token refresh
                if (nextAction.type in [TOKEN_RECEIVED, LOGIN_SUCCESS]) {
                    next(nextAction);
                    postponedRSAAs.forEach((postponed) => {
                        rsaaMiddleware(next)(postponed)
                    });
                    postponedRSAAs = []
                } else {
                    next(nextAction)
                }
            };
            if (isRSAA(action)) {
                const state = getState(),
                    token = auth.accessToken(state);
                if (token && auth.isAccessTokenExpired(state)) {
                    postponedRSAAs.push(action);
                    if (postponedRSAAs.length === 1) {
                        const action = refreshAccessToken(token);
                        return rsaaMiddleware(nextCheckPostoned)(action)
                    } else {
                        return
                    }
                }
                return rsaaMiddleware(next)(action);
            }
            return next(action);
        }
    }
}

export default createApiMiddleware();