import { RSAA } from 'redux-api-middleware';
import {withAuth} from "../util/api";
export const PLUGIN_LIST_REQUEST = '@@core/PLUGIN_LIST_REQUEST';
export const PLUGIN_LIST_SUCCESS = '@@core/PLUGIN_LIST_SUCCESS';
export const PLUGIN_LIST_FAILURE = '@@core/PLUGIN_LIST_FAILURE';


export const pluginList = () => ({
  [RSAA]: {
      endpoint: process.env.REACT_APP_API_ENDPOINT + '/api/plugins/',
      method: 'GET',
      headers: withAuth({ 'Content-Type': 'application/json' }),
      types: [
        PLUGIN_LIST_REQUEST, PLUGIN_LIST_SUCCESS, PLUGIN_LIST_FAILURE
      ]
  }
});