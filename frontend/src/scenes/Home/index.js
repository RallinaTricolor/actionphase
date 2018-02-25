import React, {Component} from 'react';
import { Route } from "react-router-dom";
import Splash from './components/Splash';
import LoginForm from './components/LoginForm';
import './index.scss';

class Home extends Component {
    render() {
        return (
            <div className="home">
                <Route exact path="/" component={Splash} />
                <Route path="/login" component={LoginForm} />
            </div>
        );
    }
}

export default Home;
