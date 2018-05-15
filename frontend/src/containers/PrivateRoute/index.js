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

/* istanbul ignore next */
const mapStateToProps = (state) => ({
  isAuthenticated: auth.isAuthenticated(state)
});

/* istanbul ignore next */
export default connect(mapStateToProps, null)(PrivateRoute);
