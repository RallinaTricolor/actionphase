import React, {Component} from 'react';
import {Button, Form, FormGroup, Input, FormText, Label} from 'reactstrap';
import {Field, FieldArray, reduxForm} from 'redux-form';
import FormInput from "../../../../../../components/FormInput";

class GameForm extends Component {

    renderPlugins = ({meta: {submitting}}) => {
        const plugins = this.props.plugins;
        return plugins.map((plugin) => {
            return <div key={plugin.id}>
                <FormGroup check>
                    <Label check>
                        <Field name={`plugins[${plugin.id}].enabled`} component="input" className="form-check-input" type="checkbox"
                               disabled={submitting} value={plugin.default_enabled} />{' '}
                        {plugin.name}
                        <FormText>{plugin.description}</FormText>
                    </Label>
                </FormGroup>
            </div>
        });
    };

    render() {
        const errors = this.props.errors || {};
        const {handleSubmit, submitting} = this.props;
        return <Form onSubmit={handleSubmit}>
            <Field name="name" placeholder="Name" component={FormInput} type="text"
                   error={errors.name} disabled={submitting}/>
            <Field name="abbreviation" component={FormInput}
                   error={errors.abbreviation} disabled={submitting}
                   text={'Required, but does not need to be unique. Examples: "HoF" or "DR"'}
                   placeholder="Abbreviation"/>
            <Field type="textarea" name="description" placeholder="Description" component={FormInput}
                   error={errors.description} disabled={submitting}
            />
            <Field type="textarea" name="character_guidelines" component={FormInput}
                   error={errors.character_guidelines} disabled={submitting}
                   text="You can provide this information whenever, but you should probably include it before character creation starts!"
                   placeholder="Character Creation Guidelines"/>
            <FieldArray name="plugins" component={this.renderPlugins}/>
            <Button disabled={submitting}>Submit</Button>
        </Form>
    }
}

const ReduxGameForm = reduxForm({
    form: 'game'
})(GameForm);

export default ReduxGameForm;