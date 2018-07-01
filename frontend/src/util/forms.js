import {SubmissionError} from 'redux-form';

export function formApiAdapter(dispatch, actionCreator) {
    return (...args) =>
        dispatch(actionCreator(...args)).then(response => {
            if (response.error) {
                throw new SubmissionError(formatErrors(response));
            }
        })
}

function formatErrors(response) {
    if (response.payload && response.payload.response) {
        return response.payload.response;
    }
    return response.error;
}