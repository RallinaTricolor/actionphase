import React, {Component} from 'react';
import {Link} from "react-router-dom";
import './index.scss';

class Sidebar extends Component {
    render() {
        return <div className="sidebar">
            <div className="sidebar__title">
                Sidebar
            </div>
            <div className="sidebar__links">
                <ul>
                    <li><Link to="/">Dashboard</Link></li>
                    <li><Link to="/games">Games</Link></li>
                </ul>
            </div>
        </div>
    }
}

export default Sidebar;