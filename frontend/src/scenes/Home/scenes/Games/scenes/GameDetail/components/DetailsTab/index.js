import React, {Component} from 'react';
import {Row, Col} from 'reactstrap';
import './index.scss';

class DetailsTab extends Component {
    render() {
        return <Row className="gameDetail__content">
            <Col md="12">
                <Row>
                    <Col sm="12" md="6">
                        <div className="gameDetail__attribute gameDetail__description">
                            Description: {this.props.description}
                        </div>
                    </Col>
                    <Col sm="12" md="6">
                        <div className="gameDetail__attribute gameDetail__character_guidelines">
                            Character Guidelines: {this.props.character_guidelines}
                        </div>
                    </Col>
                </Row>
            </Col>
        </Row>
    }
}

export default DetailsTab;