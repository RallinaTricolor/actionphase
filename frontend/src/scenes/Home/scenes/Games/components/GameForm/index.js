import React, {Component} from 'react';
import {Button, Form, FormGroup, Input, FormText} from 'reactstrap';
import FormInput from "../../../../../../components/FormInput";
import autosize from 'autosize';
import PluginForm from "../PluginForm";

class GameForm extends Component {
    state = {
        disabled: false,
        name: '',
        abbreviation: '',
        description: '',
        character_guidelines: '',
        plugins: {}
    };
    handlePluginCheck = (event) => {
        const target = event.target, value = target.checked, id = target.dataset.id;
        console.log(target);
        let plugins = this.state.plugins;
        console.log(plugins);
        console.log(id);
        console.log(value);
        plugins[id] = value;
        console.log(plugins);
        this.setState({plugins: plugins});
    };
    handleInputChange = (event) => {
        const target = event.target,
            value = target.type ===
            'checkbox' ? target.checked : target.value,
            name = target.name;
        if (target.type === 'textarea') {
            autosize(target)
        }
        this.setState({
            [name]: value
        });
    };
    onSubmit = (event) => {
        event.preventDefault();
        this.setState({disabled: true});
        let attributes = this.state;
        delete(attributes['disabled']);
        this.props.onSubmit(attributes);
    };

    render() {
        const errors = this.props.errors || {};
        return <Form onSubmit={this.onSubmit}>
            <FormInput name="name" value={this.props.name} placeholder="Name" onChange={this.handleInputChange}
                       error={errors.name} disabled={this.state.disabled}/>
            <FormInput name="abbreviation" value={this.props.abbreviation} onChange={this.handleInputChange}
                       error={errors.abbreviation} disabled={this.state.disabled}
                       text={'Required, but does not need to be unique. Examples: "HoF" or "DR"'}
                       placeholder="Abbreviation"/>
            <FormInput type="textarea" name="description" value={this.props.description} placeholder="Description"
                       error={errors.description} disabled={this.state.disabled}
                       onChange={this.handleInputChange}/>
            <FormInput type="textarea" name="character_guidelines" value={this.props.character_guidelines}
                       error={errors.character_guidelines} disabled={this.state.disabled}
                       onChange={this.handleInputChange}
                       text="You can provide this information whenever, but you should probably include it before character creation starts!"
                       placeholder="Character Creation Guidelines"/>
            <PluginForm plugins={this.props.plugins} handleFunction={this.handlePluginCheck}
                        disabled={this.state.disabled}/>
            <Button disabled={this.state.disabled}>Submit</Button>
        </Form>
    }
}

export default GameForm;