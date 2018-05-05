import {Reducer} from 'redux-testkit';
import gameReducer from './games';
import * as games from '../actions/games';

const initialState = {
    game: {
        list: [],
        details: {}
    }
};

describe('GameReducer', () => {
    it('should have initial state', () => {
        expect(gameReducer()).toEqual(initialState);
    });
});