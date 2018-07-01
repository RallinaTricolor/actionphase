import React, {Component} from 'react';
import {Link} from "react-router-dom";
import PropTypes from 'prop-types'
import FormInput from '../../../../components/FormInput'
import {FormGroup, Alert, Button, Form} from 'reactstrap'
import {Field, FieldArray, reduxForm} from 'redux-form';
import './index.scss';

class LoginForm extends Component {
    render() {
        const errors = this.props.errors || {};
        const {handleSubmit, submitting} = this.props;
        return <div className="login-form">
            <Form onSubmit={handleSubmit}>
                {
                    errors.non_field_errors ?
                        <Alert color="danger">
                            {errors.non_field_errors}
                        </Alert> : ""
                }
                <Field component={FormInput} className="login-form__item" name="username" placeholder="Username" error={errors.username} />
                <Field component={FormInput} className="login-form__item" type="password" name="password" placeholder="Password" error={errors.password} />
                <Button disabled={submitting} type="submit" color="primary" className="login-form__submit-button">Login</Button>
                <FormGroup className="login-form__links">
                    <Link className="login-form__link" to="/home/register">Need an account?</Link><br/>
                    <Link className="login-form__link" to="/">Forgot your password?</Link>
                </FormGroup>
            </Form>
        </div>
    }
}

LoginForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
    errors: PropTypes.object
};

const ReduxLoginForm = reduxForm({
    form: 'login'
})(LoginForm);

export default ReduxLoginForm;
