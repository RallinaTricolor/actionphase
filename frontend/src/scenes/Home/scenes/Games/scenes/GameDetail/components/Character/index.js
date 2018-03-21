import React, { Component } from 'react';
import './index.scss';

class Character extends Component {
    render() {
        return <div className="gameDetail__character">
            {this.props.name}
        </div>
    }
}

export default Character;