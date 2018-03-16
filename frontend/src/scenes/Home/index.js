import React, {Component} from 'react';
import {Container, Row, Col} from 'reactstrap';
import './index.scss';
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Content from "./components/Content";
import Footer from "./components/Footer";

class Home extends Component {
    render() {
        return (
            <Container fluid={true} id="layout">
                <Row>
                    <Col>
                        <Header/>
                    </Col>
                </Row>
                <Row>
                    <Col lg="2">
                        <Sidebar/>
                    </Col>
                    <Col lg="10">
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
