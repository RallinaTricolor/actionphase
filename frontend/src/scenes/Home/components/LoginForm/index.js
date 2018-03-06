import React, {Component} from 'react';
import {Link} from "react-router-dom";
import PropTypes from 'prop-types'
import { FormGroup, Input, Alert, Button,  Form } from 'reactstrap'
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
            <Form onSubmit={this.onSubmit}>
                <FormGroup className="login-form__item">
                    <Input onChange={this.handleInputChange} type="text" name="username" id="username" placeholder="Username"/>
                </FormGroup>
                <FormGroup className="login-form__item">
                    <Input onChange={this.handleInputChange} type="password" name="password" id="password" placeholder="Password"/>
                </FormGroup>
                <Button type="submit" color="primary" className="login-form__submit-button">Login</Button>
                <FormGroup className="login-form__links">
                    <Link className="login-form__link" to="/">Need an account?</Link><br/>
                    <Link className="login-form__link" to="/">Forgot your password?</Link>
                </FormGroup>
            </Form>
        </div>
    }
}

LoginForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
};

export default LoginForm;
