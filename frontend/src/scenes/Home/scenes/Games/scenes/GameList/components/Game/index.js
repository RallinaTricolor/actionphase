import React, { Component } from 'react';
import {Link} from 'react-router-dom';
import './index.scss';

class Game extends Component {
    render() {
        return <div className="game">
            <div className="game__attribute game__name">
                <Link to={"/games/" + this.props.id}>{this.props.name}</Link>
            </div>
            <div className="game__attribute game__abbreviation">
                {this.props.abbreviation}
            </div>
            <div className={`game__attribute game__status game__status-${this.props.get_status_display}`}>
                {this.props.get_status_display}
            </div>
            <div className="game__attribute game__description">
                {this.props.description}
            </div>
        </div>
    }
}

export default Game;