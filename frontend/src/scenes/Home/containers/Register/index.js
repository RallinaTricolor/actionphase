import React, {Component} from 'react';
import {Link} from "react-router-dom";
import {Redirect} from 'react-router';
import {connect} from 'react-redux';
import {register} from '../../../../actions/auth';
import {authErrors, isAuthenticated} from '../../../../util/auth';
import RegistrationForm from "../../components/RegistrationForm";

const Register = (props) => {
    if (props.isAuthenticated) {
        return (
            <Redirect to="/"/>
        )
    }
    return (
        <RegistrationForm {...props}/>
    )
};

const mapStateToProps = state => ({
    errors: authErrors(state),
    isAuthenticated: isAuthenticated(state)
});
const mapDispatchToProps = dispatch => ({
    onSubmit: (username, password1, password2, email) => {
        dispatch(register(username, password1, password2, email))
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Register);
