import * as gameActions from '../actions/games';

const initialState = {
  games: {
    list: [],
    details: {}
  }
};

const gameReducer = (state=initialState, action) => {
  switch(action.type) {
    case gameActions.GAME_LIST_SUCCESS:
      return {
        list: action.payload
      };
      case gameActions.GAME_DETAIL_SUCCESS:
        return {
          details: action.payload
        };
    default:
      return state
  }
};

export default gameReducer;

export const games = (state) => state.games.list;
export const game = (state) => state.games.details;