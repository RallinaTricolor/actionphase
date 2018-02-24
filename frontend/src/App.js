import React, { Component } from 'react';
import {store, persistor} from "./configureStore";
import LayoutContainer from "./containers/LayoutContainer";
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

class App extends Component {
  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
            <LayoutContainer />
        </PersistGate>
    </Provider>
    );
  }
}

export default App;
