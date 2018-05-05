import {Reducer} from 'redux-testkit';
import gameReducer, {games, game, isGameMaster} from './games';
import * as gameActions from '../actions/games';

const initialState = {
    game: {
        list: [],
        details: {}
    }
};

const functionTestState = {
    game: {
        list: [
            {
                name: "Test Game"
            }
        ],
        details: {
            name: "Test Game",
            game_master: {
                id: 1,
                name: "Test User"
            }
        }
    },
    auth: {
        access: {
            user_id: 1
        }
    }
};

const notGmState = {
    game: {
        list: [
            {
                name: "Test Game"
            }
        ],
        details: {
            name: "Test Game",
            game_master: {
                id: 1,
                name: "Test User"
            }
        }
    },
    auth: {
        access: {
            user_id: 2
        }
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
        Reducer(gameReducer).expect({type: gameActions.GAME_LIST_SUCCESS, payload: requestPayload}).toReturnState(gameListSuccess);
    });
    it('should return a game details from the API on detail success', () => {
        Reducer(gameReducer).expect({type: gameActions.GAME_DETAIL_SUCCESS, payload: requestPayload}).toReturnState(gameDetailSuccess);
    });
    it('should export a function called "games" which returns the list of games from state', () => {
        expect(games(functionTestState)).toBe(functionTestState.game.list);
    });
    it('should export a function called "game" which returns the game details from state', () => {
        expect(game(functionTestState)).toBe(functionTestState.game.details);
    });
    it('should export a function called "isGameMaster" which returns true if the logged in user is the game master of the current game', () => {
        expect(isGameMaster(functionTestState)).toBe(true);
    });
    it('should export a function called "isGameMaster" which returns false if the logged in user is not the game master of the current game', () => {
        expect(isGameMaster(notGmState)).toBe(false);
    });
});