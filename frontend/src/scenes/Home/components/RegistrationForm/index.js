import React, {Component} from 'react';
import {Link} from "react-router-dom";
import PropTypes from 'prop-types';
import {TextInput} from '../../../../components/TextInput';
import {FormGroup, Alert, Button, Form} from 'reactstrap';
import './index.scss';

class RegistrationForm extends Component {
    state = {
        email: '',
        username: '',
        password1: '',
        password2: ''
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
        this.props.onSubmit(this.state.username, this.state.password1, this.state.password2, this.state.email)
    };

    render() {
        const errors = this.props.errors || {};
        return <div className="registration-form">
            <Form onSubmit={this.onSubmit}>
                {
                    errors.non_field_errors ?
                        <Alert color="danger">
                            {errors.non_field_errors}
                        </Alert> : ""
                }
                <TextInput className="registration-form__item" name="email" placeholder="Email" error={errors.email}
                           onChange={this.handleInputChange}/>
                <TextInput className="registration-form__item" name="username" placeholder="Username" error={errors.username}
                           onChange={this.handleInputChange}/>
                <TextInput className="registration-form__item" name="password1" placeholder="Password" error={errors.password1}
                           type="password" onChange={this.handleInputChange}/>
               <TextInput className="registration-form__item" name="password2" placeholder="Confirm Password" error={errors.password2}
                           type="password" onChange={this.handleInputChange}/>
                <Button type="submit" color="primary" className="registration-form__submit-button">Sign Up</Button>
                <FormGroup className="registration-form__links">
                    <Link className="registration-form__link" to="/home/login">Already have an account?</Link><br/>
                    <Link className="registration-form__link" to="/home">Forgot your password?</Link>
                </FormGroup>
            </Form>
        </div>
    }
}

RegistrationForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
};

export default RegistrationForm;
