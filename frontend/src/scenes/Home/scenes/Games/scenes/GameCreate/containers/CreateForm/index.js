import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {pluginList} from "../../../../../../../../actions/core";
import {plugins} from "../../../../../../../../reducers/core";

class CreateForm extends Component {
    componentDidMount() {
        this.props.fetchPlugins();
    }

    render() {
        return <div>Test</div>
    }
}

const mapStateToProps = state => ({
    plugins: plugins(state)
});
const mapDispatchToProps = dispatch => ({
    fetchPlugins: bindActionCreators(pluginList, dispatch),
    onSubmit: (data) => {
        console.log(data);
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateForm);
