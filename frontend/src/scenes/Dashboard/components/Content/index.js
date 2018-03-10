import React, {Component} from 'react';
import {Route, Switch} from "react-router-dom";
import PrivateRoute from '../../../../containers/PrivateRoute';
import './index.scss';
import DashboardContent from "../../scenes/DashboardContent";
import Games from "../../scenes/Games";

class Content extends Component {
    render() {
        return <div className="content">
            <Switch>
                <PrivateRoute exact path="/" component={DashboardContent}/>
                <PrivateRoute path="/games" component={Games}/>
            </Switch>
        </div>
    }
}

export default Content;