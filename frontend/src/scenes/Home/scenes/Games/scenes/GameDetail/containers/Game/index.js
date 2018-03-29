import React, {Component} from 'react';
import './index.scss';
import DetailsTab from "../../components/DetailsTab";
import SignupsTab from "../../components/SignupsTab";
import CharactersTab from "../../components/CharactersTab";
import {TabContent, TabPane, Nav, NavItem, NavLink, Row, Col, Breadcrumb, BreadcrumbItem} from 'reactstrap';
import {Route, Switch, Link} from "react-router-dom";
import classnames from 'classnames';
import GameHeader from "../../../../components/GameHeader";

class GameDetailContainer extends Component {
    constructor(props) {
        super(props);

        this.toggle = this.toggle.bind(this);
        this.state = {
            activeTab: '1'
        };
    }

    toggle(tab) {
        if (this.state.activeTab !== tab) {
            this.setState({
                activeTab: tab
            });
        }
    }

    render() {
        return <div className="gameDetailContainer">
            <Breadcrumb>
                <BreadcrumbItem><Link to="/">Home</Link></BreadcrumbItem>
                <BreadcrumbItem><Link to="/games">Games</Link></BreadcrumbItem>
                <BreadcrumbItem active>{this.props.name}</BreadcrumbItem>
            </Breadcrumb>
            <GameHeader {...this.props} />
            <Nav tabs>
                <NavItem>
                    <NavLink className={classnames({active: this.state.activeTab === '1'})} onClick={() => {
                        this.toggle('1');
                    }}>Details</NavLink>
                </NavItem>
                <NavItem>
                    <NavLink className={classnames({active: this.state.activeTab === '2'})} onClick={() => {
                        this.toggle('2');
                    }}>Signups</NavLink>
                </NavItem>
                <NavItem>
                    <NavLink className={classnames({active: this.state.activeTab === '3'})} onClick={() => {
                        this.toggle('3');
                    }}>Characters</NavLink>
                </NavItem>
                <NavItem>
                    <NavLink className={classnames({active: this.state.activeTab === '4'})} onClick={() => {
                        this.toggle('4');
                    }}>Threads</NavLink>
                </NavItem>
            </Nav>
            <TabContent activeTab={this.state.activeTab}>
                <TabPane tabId="1">
                    <Row>
                        <Col sm="12">
                            <DetailsTab {...this.props} />
                        </Col>
                    </Row>
                </TabPane>
                <TabPane tabId="2">
                    <Row>
                        <Col sm="12">
                            <SignupsTab {...this.props} />
                        </Col>
                    </Row>
                </TabPane>
                <TabPane tabId="3">
                    <Row>
                        <Col sm="12">
                            <CharactersTab {...this.props} />
                        </Col>
                    </Row>
                </TabPane>
            </TabContent>
        </div>

    }
}

export default GameDetailContainer;