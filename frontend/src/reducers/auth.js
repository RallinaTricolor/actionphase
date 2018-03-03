import jwtDecode from 'jwt-decode'
import * as auth from '../actions/auth'

const initialState = {
  access: undefined,
  refresh: undefined,
  errors: {},
};

const authReducer = (state=initialState, action) => {
  switch(action.type) {
    case auth.LOGIN_SUCCESS:
      return {
        access: {
          token: action.payload.access,
          ...jwtDecode(action.payload.access)
        },
        refresh: {
          token: action.payload.refresh,
          ...jwtDecode(action.payload.refresh)
        },
        errors: {}
    };
    case auth.TOKEN_RECEIVED:
      return {
        ...state,
        access: {
          token: action.payload.access,
          ...jwtDecode(action.payload.access)
        }
      };
    case auth.LOGIN_FAILURE:
    case auth.TOKEN_FAILURE:
      return {
         access: undefined,
         refresh: undefined,
         errors:
             action.payload.response ||
                {'non_field_errors': action.payload.statusText},
      };
    default:
      return state
    }
};

export default authReducer;