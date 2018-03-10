import { RSAA } from 'redux-api-middleware';
import {withAuth} from "../util/api";
export const GAME_LIST_REQUEST = '@@games/GAME_LIST_REQUEST';
export const GAME_LIST_SUCCESS = '@@games/GAME_LIST_SUCCESS';
export const GAME_LIST_FAILURE = '@@games/GAME_LIST_FAILURE';


export const gameList = () => ({
  [RSAA]: {
      endpoint: '/api/games/',
      method: 'GET',
      headers: withAuth({ 'Content-Type': 'application/json' }),
      types: [
        GAME_LIST_REQUEST, GAME_LIST_SUCCESS, GAME_LIST_FAILURE
      ]
  }
});