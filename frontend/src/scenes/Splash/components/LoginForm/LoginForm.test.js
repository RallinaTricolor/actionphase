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
            onSubmit: jest.fn()
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
});