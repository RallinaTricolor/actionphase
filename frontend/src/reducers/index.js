import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import authReducer from './auth'
 
const actionPhaseApp = combineReducers({
    routerReducer,
    authReducer,
});
 
export default actionPhaseApp