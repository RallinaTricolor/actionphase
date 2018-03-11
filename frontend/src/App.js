import React, { Component } from 'react';
import {store, persistor} from "./configureStore";
import Splash from "./scenes/Splash";
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import PrivateRoute from './containers/PrivateRoute';
import Home from "./scenes/Home";

class App extends Component {
  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
            <Router>
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
