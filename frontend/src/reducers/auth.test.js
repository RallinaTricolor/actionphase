import {Reducer} from 'redux-testkit';
import authReducer from './auth';
import * as auth from '../actions/auth';

const initialState = {
    access: undefined,
    fetching: false,
    errors: {},
};

// Sample token and decoded token taken from here: https://scotch.io/tutorials/the-anatomy-of-a-json-web-token
// There's no special meaning to it, it was just an easy reference of someone who had a properly encoded token online
const decodedToken = {
    "iss": "scotch.io",
    "exp": 1300819380,
    "name": "Chris Sevilleja",
    "admin": true
};

const samplePayload = {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzY290Y2guaW8iLCJleHAiOjEzMDA4MTkzODAsIm5hbWUiOiJDaHJpcyBTZXZpbGxlamEiLCJhZG1pbiI6dHJ1ZX0.03f329983b86f7d9a9f5fef85305880101d5e302afafa20154d094b229f75773'
};

const successResult = {
    access: {
        token: samplePayload.token,
        ...decodedToken
    },
    fetching: false,
    errors: {}
};

describe('AuthReducer', () => {
    it('should have initial state', () => {
        expect(authReducer()).toEqual(initialState);
    });
    it('should return unmutated initial state by default', () => {
        Reducer(authReducer).expect({type: 'NOT_EXISTING'}).toReturnState(initialState);
    });
    it('should handle access token on login success', () => {
        Reducer(authReducer).expect({type: auth.LOGIN_SUCCESS, payload: samplePayload}).toReturnState(successResult);
    });
    it('should handle access token on registration success', () => {
        Reducer(authReducer).expect({type: auth.REGISTRATION_SUCCESS, payload: samplePayload}).toReturnState(successResult);
    });
});