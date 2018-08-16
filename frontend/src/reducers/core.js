import * as coreActions from '../actions/core';

const initialState = {
    plugins: []
};

const coreReducer = (state = initialState, action) => {
    if (typeof action === 'undefined') {
        return initialState;
    }
    switch (action.type) {
        case coreActions.PLUGIN_LIST_SUCCESS:
            return {
                plugins: action.payload
            };
        default:
            return state
    }
};

export const plugins = (state) => state.core.plugins;

export default coreReducer;
