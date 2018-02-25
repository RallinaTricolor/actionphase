import React, {Component} from 'react';
import { Link } from "react-router-dom";
import './index.scss';

class Home extends Component {
    render() {
        return (
            <div className="splash-page">
                <div className="splash-page-content">
                    <div className="splash-page-content__logo"></div>
                    <div className="splash-page-content__buttons">
                        <Link className="splash-page-content__login-button" to="/login">Login</Link>
                        <Link className="splash-page-content__register-button" to="/register">Sign Up</Link>
                    </div>
                </div>
            </div>
        );
    }
}

export default Home;
