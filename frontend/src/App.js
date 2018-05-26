import React, { Component } from 'react';
import {store, persistor, history} from "./configureStore";
import Splash from "./scenes/Splash";
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { Route, Switch } from "react-router-dom";
import { ConnectedRouter as Router } from 'react-router-redux';
import PrivateRoute from './containers/PrivateRoute';
import Home from "./scenes/Home";

class App extends Component {
  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
            <Router history={history}>
                <Switch>
                    <Route path="/home/" component={Splash} />
                    <PrivateRoute path="/" component={Home}/>
                </Switch>
            </Router>
        </PersistGate>
    </Provider>
    );
  }
}

export default App;
