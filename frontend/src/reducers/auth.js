import jwtDecode from 'jwt-decode'
import * as auth from '../actions/auth'

const initialState = {
    access: undefined,
    errors: {},
};

const authReducer = (state = initialState, action) => {
    if (typeof action === 'undefined') {
        return initialState;
    }
    switch (action.type) {
        case auth.LOGIN_SUCCESS:
        case auth.REGISTRATION_SUCCESS:
        case auth.TOKEN_RECEIVED:
            return {
                access: {
                    token: action.payload.token,
                    ...jwtDecode(action.payload.token)
                },
                errors: {}
            };
        case auth.LOGIN_FAILURE:
        case auth.REGISTRATION_FAILURE:
        case auth.TOKEN_FAILURE:
            return {
                access: undefined,
                errors:
                action.payload.response ||
                {'non_field_errors': action.payload.statusText},
            };
        case auth.LOGOUT:
            return {
                access: undefined,
                errors: {}
            };
        default:
            return state
    }
};

export default authReducer;