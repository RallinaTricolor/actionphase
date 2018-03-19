import React, { Component } from 'react';
import './index.scss';

class DetailsTab extends Component {
    render() {
        return <div className="gameDetail__content">
            <div className="gameDetail__attribute gameDetail__game_master">
                Game Master: {this.props.game_master ? this.props.game_master.username : ''}
            </div>
            <div className="gameDetail__attribute gameDetail__abbreviation">
                Abbreviation: {this.props.abbreviation}
            </div>
            <div className={`gameDetail__attribute gameDetail__status gameDetail__status-${this.props.get_status_display}`}>
                Status: {this.props.get_status_display}
            </div>
            <div className="gameDetail__attribute gameDetail__description">
                Description: {this.props.description}
            </div>
            <div className="gameDetail__attribute gameDetail__character_guidelines">
                Character Guidelines: {this.props.character_guidelines}
            </div>
        </div>
    }
}

export default DetailsTab;