import React, {Component} from 'react';
import {Route, Switch} from "react-router-dom";
import {TransitionGroup, CSSTransition} from "react-transition-group";
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
                            <TransitionGroup>
                                <CSSTransition key={location.key} classNames="fade" timeout={200}>
                                    <Switch location={location}>
                                        <Route exact path="/" component={Splash}/>
                                        <Route path="/login" component={Login}/>
                                    </Switch>
                                </CSSTransition>
                            </TransitionGroup>
                        </div>
                    )}
                />
            </div>
        );
    }
}

export default Home;
