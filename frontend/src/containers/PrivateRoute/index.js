import React from 'react';
import { Route, Redirect } from 'react-router';
import { connect } from 'react-redux';
import * as auth from '../../util/auth';

export const PrivateRoute = ({ component: Component, isAuthenticated, ...rest }) => (
  <Route {...rest} render={props => (
    isAuthenticated ? (
      <Component {...props}/>
    ) : (
      <Redirect to={{
        pathname: '/home',
        state: { from: props.location }
      }}/>
    )
  )}/>
);

const mapStateToProps = (state) => ({
  isAuthenticated: auth.isAuthenticated(state)
});

export default connect(mapStateToProps, null)(PrivateRoute);
