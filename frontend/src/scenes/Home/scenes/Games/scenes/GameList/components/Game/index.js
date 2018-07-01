import React, { Component } from 'react';
import {Row, Col} from 'reactstrap';
import {Link} from 'react-router-dom';
import './index.scss';

class Game extends Component {
    render() {
        return <Row className="game">
            <Col sm="2" className="game__attribute game__name">
                <Link to={"/games/" + this.props.id}>{this.props.name}</Link>
            </Col>
            <Col sm="2" className="game__attribute game__abbreviation">
                {this.props.abbreviation}
            </Col>
            <Col sm="2" className={`game__attribute game__status game__status-${this.props.get_status_display}`}>
                {this.props.get_status_display}
            </Col>
            <Col sm="2" className="game__attribute game__game_master">
                {this.props.game_master ? this.props.game_master.username : ''}
            </Col>
        </Row>
    }
}

export default Game;