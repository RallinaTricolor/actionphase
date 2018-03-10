import * as games from '../actions/games';

const initialState = {
  games: {}
};

const gameReducer = (state=initialState, action) => {
  switch(action.type) {
    case games.GAME_LIST_SUCCESS:
      return {
        games: action.payload.games
      };
    default:
      return state
  }
};

export default gameReducer;