import Immutable from 'seamless-immutable';
import {Reducer} from 'redux-testkit';
import authReducer from './auth';

const initialState = {
    access: undefined,
    fetching: false,
    errors: {},
};

describe('AuthReducer', () => {
    it('should have initial state', () => {
        expect(authReducer()).toEqual(initialState);
    });
    it('should return unmutated initial state by default', () => {
        Reducer(authReducer).expect({type: 'NOT_EXISTING'}).toReturnState(initialState);
    });
});