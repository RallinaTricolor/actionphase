import React, {Component} from 'react';
import {connect} from 'react-redux'

const GameCreate = (props) => {
    return (
        <div>Test</div>
    )
};

const mapStateToProps = state => ({

});
const mapDispatchToProps = dispatch => ({
    onSubmit: (data) => {

    }
});

export default connect(mapStateToProps, mapDispatchToProps)(GameCreate);
