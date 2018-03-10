import React, { Component } from 'react';
import './index.scss';
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";

class Dashobard extends Component {
  render() {
    return (
      <div id="layout">
          <Header/>
          <Sidebar/>
          <content>Content</content>
          <footer>Footer</footer>
      </div>
    );
  }
}

export default Dashobard;
