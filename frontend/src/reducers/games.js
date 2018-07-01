import * as gameActions from '../actions/games';

const initialState = {
    game: {
        list: [],
        details: {}
    }
};

const gameReducer = (state = initialState, action) => {
    if (typeof action === 'undefined') {
        return initialState;
    }
    switch (action.type) {
        case gameActions.GAME_LIST_SUCCESS:
            return {
                list: action.payload
            };
        case gameActions.GAME_DETAIL_SUCCESS:
            return {
                details: action.payload
            };
        case gameActions.GAME_CREATE_FAILURE:
            return {
                errors:
                action.payload.response ||
                {'non_field_errors': action.payload.statusText}
            };
        default:
            return state
    }
};

export default gameReducer;

export const games = (state) => state.game.list;
export const game = (state) => state.game.details;

export const isGameMaster = (state) => {
    if (state.game.details && state.auth.access) {
        return state.game.details.game_master.id === state.auth.access.user_id;
    }
    return false;
};

export const gameErrors = (state) => state.game.errors;