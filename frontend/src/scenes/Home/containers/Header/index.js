import React, { Component } from 'react';
import Header from "../../components/Header";
import {LOGOUT} from "../../../../actions/auth";
import {connect} from 'react-redux';
import {authErrors} from "../../../../util/auth";

class HeaderContainer extends Component {
    render() {
        return <Header {...this.props} />
    }
}

const mapStateToProps = state => ({
    errors: authErrors(state)
});

const mapDispatchToProps = dispatch => ({
    onLogoutClick: () => {
        dispatch({type: LOGOUT})
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderContainer);
