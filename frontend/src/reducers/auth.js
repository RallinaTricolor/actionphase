import jwtDecode from 'jwt-decode'
import * as auth from '../actions/auth'

const initialState = {
  access: undefined,
  errors: {},
};

const authReducer = (state=initialState, action) => {
  switch(action.type) {
    case auth.LOGIN_SUCCESS:
      return {
        access: {
          token: action.payload.token,
          ...jwtDecode(action.payload.token)
        },
        errors: {}
    };
    case auth.TOKEN_RECEIVED:
      return {
        ...state,
        access: {
          token: action.payload.token,
          ...jwtDecode(action.payload.token)
        }
      };
    case auth.LOGIN_FAILURE:
    case auth.TOKEN_FAILURE:
      return {
         access: undefined,
         errors:
             action.payload.response ||
                {'non_field_errors': action.payload.statusText},
      };
    default:
      return state
    }
};

export default authReducer;