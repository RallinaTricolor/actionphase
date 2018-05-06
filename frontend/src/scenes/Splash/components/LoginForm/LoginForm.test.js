import React from "react";
import {mount} from "enzyme";
import {MemoryRouter} from 'react-router';
import LoginForm from "./index";

describe("LoginForm", () => {
    let props;
    let mountedLoginForm;
    const loginForm = () => {
        if (!mountedLoginForm) {
            mountedLoginForm = mount(
                <MemoryRouter initialEntries={['/test']}>
                    <LoginForm {...props}/>
                </MemoryRouter>
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
        const usernameInput = loginForm().find("TextInput[name='username']");
        expect(usernameInput.length).toBe(1);
    });
    it("always renders a password input", () => {
        const passwordInput = loginForm().find("TextInput[name='password']");
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
                expect(alert.text()).toBe(props.errors.non_field_errors)
            })
        });
        describe("and there are errors on the username field", () => {
            beforeEach(() => {
                props = {
                    onSubmit: jest.fn(),
                    errors: {
                        username: "Test Error Message"
                    }
                }
            });
            it("renders an error on the username input", () => {
                const usernameInput = loginForm().find("TextInput[name='username']");
                expect(usernameInput.prop('error')).toBe(props.errors.username);
            });
        });
        describe("and there are errors on the password field", () => {
            beforeEach(() => {
                props = {
                    onSubmit: jest.fn(),
                    errors: {
                        password: "Test Error Message"
                    }
                }
            });
            it("renders an error on the password input", () => {
                const passwordInput = loginForm().find("TextInput[name='password']");
                expect(passwordInput.prop('error')).toBe(props.errors.password);
            });
        });
    });
});