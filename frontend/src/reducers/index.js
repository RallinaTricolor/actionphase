import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import authReducer from './auth'
import gameReducer from "./games";
 
const actionPhaseApp = combineReducers({
    router: routerReducer,
    auth: authReducer,
    game: gameReducer
});
 
export default actionPhaseApp