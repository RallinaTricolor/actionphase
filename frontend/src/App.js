import React, { Component } from 'react';
import {store, persistor} from "./configureStore";
import Home from "./scenes/Home";
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import PrivateRoute from './containers/PrivateRoute';
import Dashboard from "./scenes/Dashboard";

class App extends Component {
  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
            <Router>
                <Switch>
                    <Route path="/home/" component={Home} />
                    <PrivateRoute path="/" component={Dashboard}/>
                </Switch>
            </Router>
        </PersistGate>
    </Provider>
    );
  }
}

export default App;
