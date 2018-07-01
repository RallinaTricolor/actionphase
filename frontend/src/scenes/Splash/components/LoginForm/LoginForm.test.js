import React from "react";
import {shallow} from "enzyme";
import {MemoryRouter} from 'react-router';
import sinon from 'sinon';
import ReactRouterEnzymeContext from 'react-router-enzyme-context';

import {LoginForm} from "./index";

describe("LoginForm", () => {
    let props;
    let mountedLoginForm;
    const loginForm = () => {
        if (!mountedLoginForm) {
            const options = new ReactRouterEnzymeContext();
            mountedLoginForm = shallow(
                <LoginForm {...props}/>,
                options.get()
            );
        }
        return mountedLoginForm;
    };
    beforeEach(() => {
        props = {
            onSubmit: jest.fn(),
            errors: {}
        };
        mountedLoginForm = undefined;
    });
    it("always renders a div", () => {
        const divs = loginForm().find("div");
        expect(divs.length).toBeGreaterThan(0);
    });
    it("always renders a username input", () => {
        const usernameInput = loginForm().find("Field[name='username']");
        expect(usernameInput.length).toBe(1);
    });
    it("always renders a password input", () => {
        const passwordInput = loginForm().find("Field[name='password']");
        expect(passwordInput.length).toBe(1);
    });
    describe("when 'errors' is defined", () => {
        describe("and there are non-field errors", () => {
            beforeEach(() => {
                props = {
                    onSubmit: jest.fn(),
                    errors: {
                        non_field_errors: "Test Error Message"
                    }
                }
            });
            it("renders an Alert with the error message", () => {
                const alert = loginForm().find("Alert");
                expect(alert.length).toBe(1);
            })
        });
    });
});