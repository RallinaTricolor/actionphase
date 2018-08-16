import React from 'react';
import {withRouter} from "react-router-dom";
import {connect} from 'react-redux'
import {login} from '../../../../actions/auth'
import {authErrors} from '../../../../util/auth'
import LoginForm from '../../components/LoginForm'
import {formApiAdapter} from "../../../../util/forms";

const Login = (props) => {
    return (
        <LoginForm {...props}/>
    )
};
/* istanbul ignore next */
const mapStateToProps = state => ({
    errors: authErrors(state)
});
/* istanbul ignore next */
const mapDispatchToProps = dispatch => ({
    onSubmit: formApiAdapter(dispatch, login)
});
/* istanbul ignore next */
export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Login));
