import React, {Component} from 'react';
import {Link} from "react-router-dom";
import PropTypes from 'prop-types'
import './index.scss';

class LoginForm extends Component {
    state = {
        username: '',
        password: ''
    };
    handleInputChange = (event) => {
        const target = event.target,
            value = target.type ===
            'checkbox' ? target.checked : target.value,
            name = target.name;
        this.setState({
            [name]: value
        });
    };
    onSubmit = (event) => {
        event.preventDefault();
        this.props.onSubmit(this.state.username, this.state.password)
    };

    render() {
        return <div className="login-form">
            <form onSubmit={this.onSubmit}>
                <div className="login-form__item">
                    <input onChange={this.handleInputChange} type="text" name="username" id="username" placeholder="Username"/>
                </div>
                <div className="login-form__item">
                    <input onChange={this.handleInputChange} type="password" name="password" id="password" placeholder="Password"/>
                </div>
                <button type="submit" className="login-form__submit-button">Login</button>
                <div className="login-form__links">
                    <Link className="login-form__link" to="/">Need an account?</Link><br/>
                    <Link className="login-form__link" to="/">Forgot your password?</Link>
                </div>
            </form>
        </div>
    }
}

LoginForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
};

export default LoginForm;
