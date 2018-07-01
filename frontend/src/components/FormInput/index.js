import React, {Component} from 'react'
import PropTypes from 'prop-types'
import {FormGroup, FormFeedback, FormText, Label, Input} from 'reactstrap';
import autosize from 'autosize';

class FormInput extends Component {
    render () {
        const input_type = this.props.type ? this.props.type : "text";
        const onChange = input_type === "textarea" ? (event, newValue, previousValue, name) => {
            this.props.input.onChange(event, newValue, previousValue, name); autosize(event.target)
        } : this.props.input.onChange;
        const { input: { value, name } } = this.props;
        const id = `id_${name}`;
        const { meta: { error, submitting } } = this.props;
        return <FormGroup color={error ? "danger" : ""}>
            {this.props.label ? <Label htmlFor={id}>{this.props.label}</Label> : ""}
            <Input type={input_type} name={name} id={id} className={error ? "is-invalid" : ""} onChange={onChange} value={value} placeholder={this.props.placeholder} disabled={submitting}/>
            {this.props.text ? <FormText>{this.props.text}</FormText> : ""}
            {error ? <FormFeedback className="invalid-feedback">{error}</FormFeedback> : ""}
        </FormGroup>
    }
}

FormInput.propTypes = {
    label: PropTypes.string,
    error: PropTypes.array,
    type: PropTypes.string,
    text: PropTypes.string
};

export default FormInput;