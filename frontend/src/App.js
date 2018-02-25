import React, { Component } from 'react';
import {store, persistor} from "./configureStore";
import Home from "./scenes/Home";
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter as Router } from "react-router-dom";

class App extends Component {
  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
            <Router>
                <Home />
            </Router>
        </PersistGate>
    </Provider>
    );
  }
}

export default App;
