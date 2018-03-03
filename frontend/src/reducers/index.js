import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import core from './core'
 
const actionPhaseApp = combineReducers({
    routerReducer,
    core
});
 
export default actionPhaseApp