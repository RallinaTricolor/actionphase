import React, { Component } from 'react';
import './index.scss';

class Dashobard extends Component {
  render() {
    return (
      <div id="layout">
          <header>Header</header>
          <sidebar>Sidebar</sidebar>
          <content>Content</content>
          <footer>Footer</footer>
      </div>
    );
  }
}

export default Dashobard;
