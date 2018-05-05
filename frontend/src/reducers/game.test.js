import {Reducer} from 'redux-testkit';
import gameReducer from './games';
import * as games from '../actions/games';

const initialState = {
    game: {
        list: [],
        details: {}
    }
};

const requestPayload = "PAYLOAD";
const gameListSuccess = {
    list: requestPayload
};
const gameDetailSuccess = {
    details: requestPayload
};

describe('GameReducer', () => {
    it('should have initial state', () => {
        expect(gameReducer()).toEqual(initialState);
    });
    it('should return unmutated initial state by default', () => {
        Reducer(gameReducer).expect({type: 'NOT_EXISTING'}).toReturnState(initialState);
    });
    it('should return a list of games from the API on list success', () => {
        Reducer(gameReducer).expect({type: games.GAME_LIST_SUCCESS, payload: requestPayload}).toReturnState(gameListSuccess);
    });
    it('should return a game details from the API on detail success', () => {
        Reducer(gameReducer).expect({type: games.GAME_DETAIL_SUCCESS, payload: requestPayload}).toReturnState(gameDetailSuccess);
    });
});