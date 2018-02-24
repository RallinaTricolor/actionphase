import { createStore } from 'redux'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

import actionPhaseApp from './reducers/';

const persistConfig = {
  key: 'root',
  storage,
};

const persistedReducer = persistReducer(persistConfig, actionPhaseApp);

let store = createStore(persistedReducer);
let persistor = persistStore(store);

export { store, persistor };