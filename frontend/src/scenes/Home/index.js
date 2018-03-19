import React, {Component} from 'react';
import {Container, Row, Col} from 'reactstrap';
import './index.scss';
import Content from "./components/Content";
import Footer from "./components/Footer";
import HeaderContainer from "./containers/Header";

class Home extends Component {
    render() {
        return (
            <Container fluid={true} id="layout">
                <Row>
                    <Col>
                        <HeaderContainer/>
                    </Col>
                </Row>
                <Row>
                    <Col lg="12">
                        <Content/>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <Footer/>
                    </Col>
                </Row>
            </Container>
        );
    }
}

export default Home;
