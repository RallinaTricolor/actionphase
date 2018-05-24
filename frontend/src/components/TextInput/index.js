import React from 'react'
import PropTypes from 'prop-types'
import {FormGroup, FormFeedback, FormText, Label, Input} from 'reactstrap';

const TextInput = ({name, label, error, type, text, ...rest}) => {
    const id = `id_${name}`,
        input_type = type ? type : "text";
    return (
        <FormGroup color={error ? "danger" : ""}>
            {label ? <Label htmlFor={id}>{label}</Label> : ""}
            <Input type={input_type} name={name} id={id} className={error ? "is-invalid" : ""} {...rest} />
            {text ? <FormText>{text}</FormText> : ""}
            {error ? <FormFeedback className="invalid-feedback">{error}</FormFeedback> : ""}
        </FormGroup>
    )
};

TextInput.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string,
    error: PropTypes.string,
    type: PropTypes.string,
    text: PropTypes.string
};

export default TextInput;