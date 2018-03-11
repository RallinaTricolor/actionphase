import React, {Component} from 'react';
import {Link} from "react-router-dom";
import {Redirect} from 'react-router';
import {connect} from 'react-redux';
import {register} from '../../../../actions/auth';
import {authErrors} from '../../../../util/auth';
import RegistrationForm from "../../components/RegistrationForm";

const Register = (props) => {
    return (
        <RegistrationForm {...props}/>
    )
};

const mapStateToProps = state => ({
    errors: authErrors(state)
});
const mapDispatchToProps = dispatch => ({
    onSubmit: (username, password1, password2, email) => {
        dispatch(register(username, password1, password2, email))
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Register);
