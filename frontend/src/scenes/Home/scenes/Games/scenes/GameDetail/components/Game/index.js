import React, { Component } from 'react';
import './index.scss';

class GameDetail extends Component {
    render() {
        return <div className="game">
            <div className="game__attribute game__name">
                {this.props.name}
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
            <div className="game__attribute game__game_master">
                {this.props.game_master ? this.props.game_master.username : ''}
            </div>
        </div>
    }
}

export default GameDetail;