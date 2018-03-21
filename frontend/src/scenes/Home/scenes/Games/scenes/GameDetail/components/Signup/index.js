import React, { Component } from 'react';
import './index.scss';

class Signup extends Component {
    render() {
        return <div className="gameDetail__signup">
            {this.props.user.username}
        </div>
    }
}

export default Signup;