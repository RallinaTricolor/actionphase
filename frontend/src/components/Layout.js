import React, { Component } from 'react';
import '../sass/components/Layout.scss';

class Layout extends Component {
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

export default Layout;
