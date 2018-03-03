import { applyMiddleware, createStore } from 'redux'
import { persistStore, persistReducer } from 'redux-persist'
import { createFilter } from 'redux-persist-transform-filter'
import { routerMiddleware, push } from 'react-router-redux'
import { apiMiddleware } from 'redux-api-middleware'
import storage from 'redux-persist/lib/storage'
import createHistory from 'history/createBrowserHistory'

import actionPhaseApp from './reducers/';

const history = createHistory();

const persistedFilter = createFilter(
    'auth', ['access', 'refresh']
);

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'],
  transforms: [persistedFilter]
};

const persistedReducer = persistReducer(persistConfig, actionPhaseApp);

let store = createStore(persistedReducer, {}, applyMiddleware(
    apiMiddleware,
    routerMiddleware(history)
));
let persistor = persistStore(store);

export { store, persistor };