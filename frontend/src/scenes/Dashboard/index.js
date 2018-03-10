import React, { Component } from 'react';
import './index.scss';
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Content from "./components/Content";

class Dashobard extends Component {
  render() {
    return (
      <div id="layout">
          <Header/>
          <Sidebar/>
          <Content/>
          <footer>Footer</footer>
      </div>
    );
  }
}

export default Dashobard;
