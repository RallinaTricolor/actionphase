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
});