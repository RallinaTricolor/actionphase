import React, {Component} from 'react';
import {connect} from 'react-redux';
import {Row, Col, Breadcrumb, BreadcrumbItem} from 'reactstrap';
import {Link} from 'react-router-dom';
import CreateForm from './containers/CreateForm';

class GameCreate extends Component {
    render() {
        return <Row>
            <Col size="12">
                <Row>
                    <Col size="12">
                        <Breadcrumb>
                            <BreadcrumbItem><Link to="/">Home</Link></BreadcrumbItem>
                            <BreadcrumbItem><Link to="/games">Games</Link></BreadcrumbItem>
                            <BreadcrumbItem active>Create</BreadcrumbItem>
                        </Breadcrumb>
                    </Col>
                </Row>
                <Row>
                    <Col size="12">
                        <h2>Create A Game</h2>
                    </Col>
                </Row>
                <Row>
                    <Col size="12">
                        <CreateForm/>
                    </Col>
                </Row>
            </Col>
        </Row>
    }
}

export default GameCreate
