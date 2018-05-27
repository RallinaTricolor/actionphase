import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import authReducer from './auth'
import gameReducer from "./games";
import coreReducer from "./core";
 
const actionPhaseApp = combineReducers({
    router: routerReducer,
    auth: authReducer,
    core: coreReducer,
    game: gameReducer
});
 
export default actionPhaseApp