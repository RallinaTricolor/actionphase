import React, { Component } from 'react';
import './index.scss';
import Header from "./components/Header";

class Dashobard extends Component {
  render() {
    return (
      <div id="layout">
          <Header/>
          <sidebar>Sidebar</sidebar>
          <content>Content</content>
          <footer>Footer</footer>
      </div>
    );
  }
}

export default Dashobard;
