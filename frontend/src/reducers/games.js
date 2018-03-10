import * as gameActions from '../actions/games';

const initialState = {
  games: {
    list: []
  }
};

const gameReducer = (state=initialState, action) => {
  switch(action.type) {
    case gameActions.GAME_LIST_SUCCESS:
      return {
        list: action.payload
      };
    default:
      return state
  }
};

export default gameReducer;

export const games = (state) => state.games.list;