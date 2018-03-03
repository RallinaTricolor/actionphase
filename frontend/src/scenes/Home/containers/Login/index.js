import React, {Component} from 'react';
import { Link } from "react-router-dom";
import { Redirect } from 'react-router'
import { connect } from 'react-redux'
import {login} from  '../../../../actions/auth'
import {authErrors, isAuthenticated} from '../../../../util/auth'
import LoginForm from '../../components/LoginForm'

const mapStateToProps = state => ({
  errors: authErrors(state),
  isAuthenticated: isAuthenticated(state)
});
const mapDispatchToProps = dispatch => ({
  onSubmit: (username, password) => {
    dispatch(login(username, password))
  }
});

const Login = connect(mapStateToProps, mapDispatchToProps)(LoginForm);

export default Login;
