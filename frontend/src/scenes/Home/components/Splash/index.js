import React, {Component} from 'react';
import { Link } from "react-router-dom";
import './index.scss';

class Splash extends Component {
    render() {
        return (
            <div className="splash-page">
                <div className="splash-page__content">
                    <div className="splash-page__title">Action Phase</div>
                    <div className="splage-page__tagline">Who will <i>you</i> be?</div>
                    <div className="splash-page__buttons">
                        <Link className="splash-page__login-button" to="/login">Login</Link>
                        <Link className="splash-page__register-button" to="/register">Sign Up</Link>
                    </div>
                </div>
            </div>
        );
    }
}

export default Splash;
