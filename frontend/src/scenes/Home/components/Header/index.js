import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import {Navbar, NavbarBrand, NavbarToggler, Collapse, Nav, NavItem, NavLink, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem} from 'reactstrap';
import './index.scss';

class Header extends Component {
    constructor(props) {
        super(props);

        this.toggle = this.toggle.bind(this);
        this.state = {
            isOpen: false
        };
    }

    toggle() {
        this.setState({
            isOpen: !this.state.isOpen
        });
    }

    render() {
        return <Navbar color="dark" dark expand="md" className="header">
            <NavbarBrand tag={Link} to="/">Action Phase</NavbarBrand>
            <NavbarToggler onClick={this.toggle}/>
            <Collapse isOpen={this.state.isOpen} navbar>
                <Nav className="ml-auto" navbar>
                    <NavItem>
                        <NavLink tag={Link} to="/">Dashboard</NavLink>
                    </NavItem>
                    <NavItem>
                        <NavLink tag={Link} to="/games">Games</NavLink>
                    </NavItem>
                    <UncontrolledDropdown nav inNavbar>
                        <DropdownToggle nav caret>
                            Account
                        </DropdownToggle>
                        <DropdownMenu>
                            <DropdownItem>
                                Profile
                            </DropdownItem>
                            <DropdownItem>
                                Settings
                            </DropdownItem>
                            <DropdownItem divider/>
                            <DropdownItem onClick={this.props.onLogoutClick}>
                                Logout
                            </DropdownItem>
                        </DropdownMenu>
                    </UncontrolledDropdown>
                </Nav>
            </Collapse>
        </Navbar>
    }
}

export default Header;