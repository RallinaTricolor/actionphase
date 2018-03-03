import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import core from './core'
import authReducer from './auth'
 
const actionPhaseApp = combineReducers({
    routerReducer,
    core,
    authReducer,
});
 
export default actionPhaseApp