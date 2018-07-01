import { RSAA } from 'redux-api-middleware';
import {withAuth} from "../util/api";
import { push } from 'react-router-redux';
import {store} from '../configureStore';
export const GAME_LIST_REQUEST = '@@games/GAME_LIST_REQUEST';
export const GAME_LIST_SUCCESS = '@@games/GAME_LIST_SUCCESS';
export const GAME_LIST_FAILURE = '@@games/GAME_LIST_FAILURE';

export const GAME_DETAIL_REQUEST = '@@games/GAME_DETAIL_REQUEST';
export const GAME_DETAIL_SUCCESS = '@@games/GAME_DETAIL_SUCCESS';
export const GAME_DETAIL_FAILURE = '@@games/GAME_DETAIL_FAILURE';

export const GAME_CREATE_REQUEST = '@@games/GAME_CREATE_REQUEST';
export const GAME_CREATE_SUCCESS = '@@games/GAME_CREATE_SUCCESS';
export const GAME_CREATE_FAILURE = '@@games/GAME_CREATE_FAILURE';


export const gameList = () => ({
  [RSAA]: {
      endpoint: process.env.REACT_APP_API_ENDPOINT + '/api/games/',
      method: 'GET',
      headers: withAuth({ 'Content-Type': 'application/json' }),
      types: [
        GAME_LIST_REQUEST, GAME_LIST_SUCCESS, GAME_LIST_FAILURE
      ]
  }
});

export const gameDetail = (id) => ({
  [RSAA]: {
      endpoint: process.env.REACT_APP_API_ENDPOINT + '/api/games/' + id + '/',
      method: 'GET',
      headers: withAuth({ 'Content-Type': 'application/json' }),
      types: [
        GAME_DETAIL_REQUEST, GAME_DETAIL_SUCCESS, GAME_DETAIL_FAILURE
      ]
  }
});

export const gameCreate = (data) => ({
  [RSAA]: {
      endpoint: process.env.REACT_APP_API_ENDPOINT + '/api/games/',
      method: 'POST',
      body: JSON.stringify(data),
      headers: withAuth({ 'Content-Type': 'application/json' }),
      types: [
        GAME_CREATE_REQUEST,
        {
            type: GAME_CREATE_SUCCESS,
            payload: (action, state, res) => {
                return res.json().then(json => {
                    store.dispatch(push('/games/' + json.id));
                    return json;
                });
            }
        },
        GAME_CREATE_FAILURE
      ]
  }
});