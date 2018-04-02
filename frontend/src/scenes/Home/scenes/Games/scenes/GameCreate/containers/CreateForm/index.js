import React, {Component} from 'react';
import {connect} from 'react-redux';

const CreateForm = (props) => {
    return (
        <div>Test</div>
    )
};

const mapStateToProps = state => ({
    
});
const mapDispatchToProps = dispatch => ({
    onSubmit: (data) => {
        console.log(data);
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateForm);
