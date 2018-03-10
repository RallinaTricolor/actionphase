import React, { Component } from 'react';
import './index.scss';

class Game extends Component {
    render() {
        return <div className="game">{this.props.name}</div>
    }
}

export default Game;