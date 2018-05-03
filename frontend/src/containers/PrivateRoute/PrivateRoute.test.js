import React from "react";
import {mount} from "enzyme";
import {PrivateRoute} from ".";
import { MemoryRouter } from 'react-router';

describe("PrivateRoute", () => {

    let props;
    let mountedPrivateRoute;
    const privateRoute = () => {
        if (!mountedPrivateRoute) {
            mountedPrivateRoute = mount(
                <MemoryRouter initialEntries={[ '/test' ]}>
                    <PrivateRoute path="/test" {...props} />
                </MemoryRouter>
            );
        }
        return mountedPrivateRoute;
    };

    beforeEach(() => {
        props = {
            component: 'Component',
            isAuthenticated: undefined
        };
        mountedPrivateRoute = undefined;
    });

    it("always renders a Route", () => {
        const route = privateRoute().find("Route");
        expect(route.length).toBe(1);
    });
});