import React, {Component} from 'react';
import {FormGroup, Label, Input, FormText} from 'reactstrap';

class PluginFormItem extends Component {
    render() {
        return <FormGroup check>
            <Label check>
                <Input type="checkbox" onChange={this.props.handleFunction} data-id={this.props.id} disabled={this.props.disabled} />{' '}
                {this.props.name}
                <FormText>{this.props.description}</FormText>
            </Label>
        </FormGroup>
    }
}

export default PluginFormItem;