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
    return response.error;
    // ...translate your API's error response into a redux-form-compatible error object
}