import React, {Component} from 'react';
import {Route, Switch} from "react-router-dom";
import Splash from './components/Splash';
import Login from './containers/Login';
import './index.scss';

class Home extends Component {
    render() {
        return (
            <div className="home">
                <Route
                    render={({location}) => (
                        <div>
                            <Switch location={location}>
                                <Route exact path="/" component={Splash}/>
                                <Route path="/login" component={Login}/>
                            </Switch>
                        </div>
                    )}
                />
            </div>
        );
    }
}

export default Home;
