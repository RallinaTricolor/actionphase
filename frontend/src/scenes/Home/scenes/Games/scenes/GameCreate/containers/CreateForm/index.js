import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {pluginList} from "../../../../../../../../actions/core";
import {plugins} from "../../../../../../../../reducers/core";
import GameForm from "../../../../components/GameForm";
import {Loading} from "../../../../../../../../components/Loading";

class CreateForm extends Component {
    componentDidMount() {
        this.props.fetchPlugins();
    }

    render() {
        const plugins = this.props.plugins || [];
        if (!this.props.plugins) {
            return <Loading/>
        }
        return <GameForm plugins={plugins} {...this.props}/>
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
