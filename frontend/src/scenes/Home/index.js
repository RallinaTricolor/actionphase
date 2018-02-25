import React, {Component} from 'react';
import { Route } from "react-router-dom";
import Splash from './components/Splash';
import './index.scss';

class Home extends Component {
    render() {
        return (
            <Route exact path="/" component={Splash} />
        );
    }
}

export default Home;
