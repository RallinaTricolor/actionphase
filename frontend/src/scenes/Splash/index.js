import React from 'react';
import {Redirect, Route, Switch} from "react-router-dom";
import Landing from './components/Landing';
import Login from './containers/Login';
import Register from './containers/Register';
import './index.scss';
import {isAuthenticated} from "../../util/auth";
import {connect} from 'react-redux';

const Splash = (props) => {
    if (props.isAuthenticated) {
        return (
            <Redirect to="/"/>
        )
    }
    return (
        <div className="home">
            <Route
                render={({location}) => (
                    <div>
                        <Switch location={location}>
                            <Route exact path="/home" component={Landing}/>
                            <Route path="/home/login" component={Login}/>
                            <Route path="/home/register" component={Register}/>>
                        </Switch>
                    </div>
                )}
            />
        </div>
    );
};

const mapStateToProps = state => ({
    isAuthenticated: isAuthenticated(state)
});

export default connect(mapStateToProps)(Splash);
