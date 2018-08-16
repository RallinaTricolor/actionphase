import { applyMiddleware, createStore } from 'redux'
import { persistStore, persistReducer } from 'redux-persist'
import { createWhitelistFilter } from 'redux-persist-transform-filter'
import { routerMiddleware } from 'react-router-redux'
import thunk from 'redux-thunk';
import { createApiMiddleware } from './middleware/api'
import storage from 'redux-persist/lib/storage'
import createHistory from 'history/createBrowserHistory'

import actionPhaseApp from './reducers/';

const history = createHistory();

const persistedFilter = createWhitelistFilter(
    'auth', ['access']
);

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'],
  transforms: [persistedFilter]
};

const persistedReducer = persistReducer(persistConfig, actionPhaseApp);

let store = createStore(persistedReducer, {}, applyMiddleware(
    thunk,
    createApiMiddleware(),
    routerMiddleware(history)
));
let persistor = persistStore(store);

export { store, persistor, history };