import React, {Component} from 'react';
import {Row, Col} from 'reactstrap';
import './index.scss';

class DetailsTab extends Component {
    render() {
        return <Row className="gameDetail__content">
            <Col md="12">
                <Row>
                    <Col sm="12" md="6">
                        <div className="gameDetail__attribute_label">Details</div>
                        <div className="gameDetail__attribute gameDetail__description">
                            {this.props.description}
                        </div>
                    </Col>
                    <Col sm="12" md="6">
                        <div className="gameDetail__attribute_label">Character Guidelines</div>
                        <div className="gameDetail__attribute gameDetail__character_guidelines">
                            {this.props.character_guidelines}
                        </div>
                    </Col>
                </Row>
            </Col>
        </Row>
    }
}

export default DetailsTab;