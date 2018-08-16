import { RSAA } from 'redux-api-middleware';
import axios from 'axios';
import {SubmissionError} from 'redux-form';


export const REGISTRATION_REQUEST = '@@auth/REGISTRATION_REQUEST';
export const REGISTRATION_SUCCESS = '@@auth/REGISTRATION_SUCCESS';
export const REGISTRATION_FAILURE = '@@auth/REGISTRATION_FAILURE';
export const LOGIN_REQUEST = '@@auth/LOGIN_REQUEST';
export const LOGIN_SUCCESS = '@@auth/LOGIN_SUCCESS';
export const LOGIN_FAILURE = '@@auth/LOGIN_FAILURE';
export const TOKEN_REQUEST = '@@auth/TOKEN_REQUEST';
export const TOKEN_RECEIVED = '@@auth/TOKEN_RECEIVED';
export const TOKEN_FAILURE = '@@auth/TOKEN_FAILURE';
export const LOGOUT = '@@auth/LOGOUT';

export const register = (data) => {
    return (dispatch) => {
        dispatch({type: REGISTRATION_REQUEST});
        return axios.post(process.env.REACT_APP_API_ENDPOINT + '/api/auth/registration/', data)
            .then((res) => {
                console.log(res);
                console.log(res.data);
                dispatch({type: REGISTRATION_SUCCESS, payload: res.data});
            })
            .catch((error) => {
                console.log(error);
                for (let property in error) {
                    console.log(property);
                    console.log(error[property]);
                }
                console.log(error.response);
                console.log(error.response.data);
                throw new SubmissionError(error.response.data);
            });
    }
};

export const login = (data) => ({
  [RSAA]: {
    endpoint: process.env.REACT_APP_API_ENDPOINT + '/api/auth/login/',
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
    types: [
      LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE
    ]
  }
});

export const refreshAccessToken = (data) => ({
  [RSAA]: {
    endpoint: process.env.REACT_APP_API_ENDPOINT + '/api/auth/token/refresh/',
    method: 'POST',
    body: JSON.stringify({token: data}),
    headers: { 'Content-Type': 'application/json' },
    types: [
      TOKEN_REQUEST, TOKEN_RECEIVED, TOKEN_FAILURE
    ]
  }
});