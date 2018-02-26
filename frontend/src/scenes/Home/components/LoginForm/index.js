import React, {Component} from 'react';
import { Link } from "react-router-dom";
import './index.scss';

class LoginForm extends Component {
    render() {
        return (
            <div className="login-form">
                <form>
                    <div className="login-form__item">
                        <input type="email" id="email" placeholder="Email" />
                    </div>
                    <div className="login-form__item">
                        <input type="password" id="password" placeholder="Password" />
                    </div>
                    <button type="submit" className="login-form__submit-button">Login</button>
                    <div className="login-form__links">
                        <Link className="login-form__link" to="/">Need an account?</Link><br />
                        <Link className="login-form__link" to="/">Forgot your password?</Link>
                    </div>
                </form>
            </div>
        );
    }
}

export default LoginForm;
