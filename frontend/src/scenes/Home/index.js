import React, {Component} from 'react';
import {Route, Switch} from "react-router-dom";
import Splash from './components/Splash';
import Login from './containers/Login';
import Register from './containers/Register';
import './index.scss';

class Home extends Component {
    render() {
        return (
            <div className="home">
                <Route
                    render={({location}) => (
                        <div>
                            <Switch location={location}>
                                <Route exact path="/home" component={Splash}/>
                                <Route path="/home/login" component={Login}/>
                                <Route path="/home/register" component={Register}/>>
                            </Switch>
                        </div>
                    )}
                />
            </div>
        );
    }
}

export default Home;
