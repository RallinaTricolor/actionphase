import React, {Component} from 'react';
import {Button, Form, FormGroup, Input, FormText} from 'reactstrap';
import FormInput from "../../../../../../components/FormInput";

class GameForm extends Component {
    state = {
        name: '',
        abbreviation: '',
        description: '',
        character_guidelines: ''
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
        this.props.onSubmit(this.state)
    };

    render() {
        return <Form onSubmit={this.onSubmit}>
            <FormInput name="name" value={this.props.name} placeholder="Name" onChange={this.handleInputChange}/>
            <FormInput name="abbreviation" value={this.props.abbreviation} onChange={this.handleInputChange}
                       text={'Required, but does not need to be unique. Examples: "HoF" or "DR"'}
                       placeholder="Abbreviation"/>
            <FormInput type="textarea" name="description" value={this.props.description} placeholder="Description"
                       onChange={this.handleInputChange}/>
            <FormInput type="textarea" name="character_guidelines" value={this.props.character_guidelines}
                       onChange={this.handleInputChange}
                       text="You can provide this information whenever, but you should probably include it before character creation starts!"
                       placeholder="Character Creation Guidelines"/>
            <Button>Submit</Button>
        </Form>
    }
}

export default GameForm;