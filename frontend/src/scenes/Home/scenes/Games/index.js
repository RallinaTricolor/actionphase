import React, {Component} from 'react';
import {Switch} from "react-router-dom";
import PrivateRoute from 'app/containers/PrivateRoute';
import './index.scss';
import GameList from "./scenes/GameList";
import GameDetail from './scenes/GameDetail';
import GameCreate from './scenes/GameCreate';

class Games extends Component {
    render() {
        return <Switch>
                <PrivateRoute path="/games/:id(\d+)" component={GameDetail}/>
                <PrivateRoute exact path="/games" component={GameList}/>
                <PrivateRoute exact path="/games/new" component={GameCreate}/>
            </Switch>
    }
}

export default Games;