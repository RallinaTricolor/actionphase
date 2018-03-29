import React, {Component} from 'react';
import './index.scss';
import {TabContent, TabPane, Nav, NavItem, NavLink, Row, Col, Breadcrumb, BreadcrumbItem} from 'reactstrap';

class GameHeader extends Component {
    render() {
        return <div>
            <Row>
                <Col sm="12">
                    <h2>{this.props.name} ({this.props.abbreviation})</h2>
                </Col>
            </Row>

            <Row>
                <Col sm="12">
                    <div className="gameDetail__attribute gameDetail__game_master">
                        by {this.props.game_master ? this.props.game_master.username : ''}
                    </div>
                </Col>
            </Row>

            <Row>
                <Col sm="12">
                    <div
                        className={`gameDetail__attribute gameDetail__status gameDetail__status-${this.props.get_status_display}`}>
                        {this.props.get_status_display}
                    </div>
                </Col>
            </Row>
        </div>
    }
}

export default GameHeader;