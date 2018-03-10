import React, {Component} from 'react';
import {Link} from "react-router-dom";
import {Redirect} from 'react-router'
import {connect} from 'react-redux'
import {login} from '../../../../actions/auth'
import {authErrors} from '../../../../util/auth'
import LoginForm from '../../components/LoginForm'

const Login = (props) => {
    return (
        <LoginForm {...props}/>
    )
};

const mapStateToProps = state => ({
    errors: authErrors(state)
});
const mapDispatchToProps = dispatch => ({
    onSubmit: (username, password) => {
        dispatch(login(username, password))
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Login);
