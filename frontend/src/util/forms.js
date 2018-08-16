import {SubmissionError} from 'redux-form';

export function formApiAdapter(dispatch, actionCreator) {
    return (...args) => dispatch(actionCreator(...args));
}
