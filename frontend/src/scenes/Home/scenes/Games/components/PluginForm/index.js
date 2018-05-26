import React, {Component} from 'react';
import PluginFormItem from "../PluginFormItem";

class PluginForm extends Component {
    render() {
        const plugins = this.props.plugins || [];
        return <div>
            <h3>Plugins</h3>
            {plugins.map(plugin => <PluginFormItem handleFunction={this.props.handleFunction} key={plugin.id} {...plugin} />)}
        </div>
    }
}

export default PluginForm;