import React, {Component} from 'react';
import { Link } from "react-router-dom";
import PropTypes from 'prop-types'
import './index.scss';

const LoginForm = ({ onSubmit }) => (
    <div className="login-form">
        <form onSubmit={ e => {e.preventDefault(); onSubmit();}}>
            <div className="login-form__item">
                <input type="text" name="username" id="username" placeholder="Username" />
            </div>
            <div className="login-form__item">
                <input type="password" name="password" id="password" placeholder="Password" />
            </div>
            <button type="submit" className="login-form__submit-button">Login</button>
            <div className="login-form__links">
                <Link className="login-form__link" to="/">Need an account?</Link><br />
                <Link className="login-form__link" to="/">Forgot your password?</Link>
            </div>
        </form>
    </div>
);

LoginForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
};

export default LoginForm;
