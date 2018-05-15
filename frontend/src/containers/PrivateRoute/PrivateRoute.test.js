import React from "react";
import {mount} from "enzyme";
import {PrivateRoute} from ".";
import {MemoryRouter} from 'react-router';

const FakeComponent = () => {
    return <div id="fake-component">
        <h1>Test</h1>
    </div>;
};

describe("PrivateRoute", () => {

    let props;
    let mountedPrivateRoute;
    const privateRoute = () => {
        if (!mountedPrivateRoute) {
            mountedPrivateRoute = mount(
                <MemoryRouter initialEntries={['/test']}>
                    <PrivateRoute component={FakeComponent} path="/test" {...props} />
                </MemoryRouter>
            );
        }
        return mountedPrivateRoute;
    };

    beforeEach(() => {
        props = {
            isAuthenticated: undefined
        };
        mountedPrivateRoute = undefined;
    });

    it("always renders a Route", () => {
        const route = privateRoute().find("Route");
        expect(route.length).toBe(1);
    });

    describe("the rendered Route", () => {
        it("redirects when not authenticated", () => {
            const route = privateRoute();
            expect(route.html()).toBe(null);
        });
        describe("when isAuthenticated is true", () => {
            beforeEach(() => {
                props = {
                    isAuthenticated: true
                };
            });
            it("renders the passed component", () => {
                const fakeComponent = privateRoute().find('#fake-component');
                expect(fakeComponent.length).toBe(1);
            });
        });

    });
});