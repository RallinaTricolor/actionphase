import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import { reducer as formReducer } from 'redux-form';
import authReducer from './auth'
import gameReducer from "./games";
import coreReducer from "./core";
 
const actionPhaseApp = combineReducers({
    router: routerReducer,
    form: formReducer,
    auth: authReducer,
    core: coreReducer,
    game: gameReducer
});
 
export default actionPhaseApp