import {Reducer} from 'redux-testkit';
import coreReducer, {plugins} from './core';
import * as coreActions from '../actions/core';

const initialState = {
    plugins: []
};


const requestPayload = "PAYLOAD";
const pluginSuccess = {
    plugins: requestPayload
};

describe('CoreReducer', () => {
    it('should have initial state', () => {
        expect(coreReducer()).toEqual(initialState);
    });
    it('should return unmutated initial state by default', () => {
        Reducer(coreReducer).expect({type: 'NOT_EXISTING'}).toReturnState(initialState);
    });
    it('should return a list of games from the API on list success', () => {
        Reducer(coreReducer).expect({
            type: coreActions.PLUGIN_LIST_SUCCESS,
            payload: requestPayload
        }).toReturnState(pluginSuccess);
    });
});