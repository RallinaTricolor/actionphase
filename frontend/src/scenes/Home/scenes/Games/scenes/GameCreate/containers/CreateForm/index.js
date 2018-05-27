import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import { withRouter } from 'react-router-dom';
import {pluginList} from "../../../../../../../../actions/core";
import {plugins} from "../../../../../../../../reducers/core";
import GameForm from "../../../../components/GameForm";
import {Loading} from "../../../../../../../../components/Loading";
import {gameCreate} from "../../../../../../../../actions/games";
import {gameErrors} from "../../../../../../../../reducers/games";

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
/* istanbul ignore next */
const mapStateToProps = state => ({
    plugins: plugins(state),
    errors: gameErrors(state)
});
/* istanbul ignore next */
const mapDispatchToProps = dispatch => ({
    fetchPlugins: bindActionCreators(pluginList, dispatch),
    onSubmit: (data) => {
        dispatch(gameCreate(data));
    }
});
/* istanbul ignore next */
export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CreateForm));
