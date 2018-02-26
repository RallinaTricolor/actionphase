import React, {Component} from 'react';
import {Route, Switch} from "react-router-dom";
import {TransitionGroup, CSSTransition} from "react-transition-group";
import Splash from './components/Splash';
import LoginForm from './components/LoginForm';
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
                                        <Route path="/login" component={LoginForm}/>
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
