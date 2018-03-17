import React, { Component } from 'react';
import './index.scss';

class GameDetail extends Component {
    render() {
        return <div className="gameDetail__content">
            <h2>{this.props.name}</h2>
            <div className="gameDetail__attribute gameDetail__abbreviation">
                Abbreviation: {this.props.abbreviation}
            </div>
            <div className={`gameDetail__attribute gameDetail__status gameDetail__status-${this.props.get_status_display}`}>
                Status: {this.props.get_status_display}
            </div>
            <div className="gameDetail__attribute gameDetail__description">
                Description: {this.props.description}
            </div>
            <div className="gameDetail__attribute gameDetail__game_master">
                Game Master: {this.props.game_master ? this.props.game_master.username : ''}
            </div>
        </div>
    }
}

export default GameDetail;