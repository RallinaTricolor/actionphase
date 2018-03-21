import React, {Component} from 'react';
import {Route, Switch} from "react-router-dom";
import PrivateRoute from '../../../../containers/PrivateRoute';
import './index.scss';
import GameList from "./scenes/GameList";
import GameDetail from './scenes/GameDetail';

class Games extends Component {
    render() {
        return <Switch>
                <PrivateRoute path="/games/:id" component={GameDetail}/>
                <PrivateRoute exact path="/games" component={GameList}/>
            </Switch>
    }
}

export default Games;