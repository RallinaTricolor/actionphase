import React, {Component} from 'react';
import {connect} from 'react-redux';

const CreateForm = (props) => {
    return (
        <div>Test</div>
    )
};

const mapStateToProps = state => ({
    test: 'test'
});
const mapDispatchToProps = dispatch => ({
    onSubmit: (data) => {
        console.log(data);
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateForm);
