import React, {Component} from 'react';
import {Row, Col} from 'reactstrap';
import './index.scss';

class DetailsTab extends Component {
    render() {
        return <Row className="gameDetail__content">
            <Col md="12">
                <div
                    className={`gameDetail__attribute gameDetail__status gameDetail__status-${this.props.get_status_display}`}>
                    {this.props.get_status_display}
                </div>
                <div className="gameDetail__attribute gameDetail__game_master">
                    Game Master: {this.props.game_master ? this.props.game_master.username : ''}
                </div>

                <div className="gameDetail__attribute gameDetail__description">
                    Description: {this.props.description}
                </div>
                <div className="gameDetail__attribute gameDetail__character_guidelines">
                    Character Guidelines: {this.props.character_guidelines}
                </div>
            </Col>
        </Row>
    }
}

export default DetailsTab;