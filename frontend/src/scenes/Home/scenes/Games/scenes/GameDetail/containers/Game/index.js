import React, {Component} from 'react';
import './index.scss';
import DetailsTab from "../../components/DetailsTab";
import {TabContent, TabPane, Nav, NavItem, NavLink, Row, Col} from 'reactstrap';
import {Route, Switch, Link} from "react-router-dom";
import classnames from 'classnames';

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
            <h2>{this.props.name}</h2>
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
                            <h4>Tab 2 Contents</h4>
                        </Col>
                    </Row>
                </TabPane>
            </TabContent>
        </div>

    }
}

export default GameDetailContainer;