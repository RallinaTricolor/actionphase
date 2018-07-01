import React, {Component} from 'react';
import {Link} from "react-router-dom";
import PropTypes from 'prop-types';
import {Field, FieldArray, reduxForm} from 'redux-form';
import FormInput from '../../../../components/FormInput';
import {FormGroup, Alert, Button, Form} from 'reactstrap';
import './index.scss';

class RegistrationForm extends Component {
    render() {
        const errors = this.props.errors || {};
        const {handleSubmit, submitting} = this.props;
        return <div className="registration">
            <Form onSubmit={handleSubmit}>
                {
                    errors.non_field_errors ?
                        <Alert color="danger">
                            {errors.non_field_errors}
                        </Alert> : ""
                }
                <Field component={FormInput} className="login-form__item" name="email" placeholder="Email Address" error={errors.email} />
                <Field component={FormInput} className="login-form__item" name="username" placeholder="Username" error={errors.username} />
                <Field component={FormInput} className="login-form__item" type="password" name="password1" placeholder="Password" error={errors.password1} />
                <Field component={FormInput} className="login-form__item" type="password" name="password2" placeholder="Confirm Password" error={errors.password2} />
                <Button disabled={submitting} type="submit" color="primary" className="registration-form__submit-button">Sign Up</Button>
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


const ReduxRegistrationForm = reduxForm({
    form: 'registration'
})(RegistrationForm);

export default ReduxRegistrationForm;

