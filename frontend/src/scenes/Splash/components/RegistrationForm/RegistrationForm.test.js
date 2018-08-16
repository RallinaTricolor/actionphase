import React from "react";
import {shallow} from "enzyme";
import {MemoryRouter} from 'react-router';
import ReactRouterEnzymeContext from 'react-router-enzyme-context';

import {RegistrationForm} from "./index";

describe("RegistrationForm", () => {
    let props;
    let mountedRegistrationForm;
    const registrationForm = () => {
        if (!mountedRegistrationForm) {
            const options = new ReactRouterEnzymeContext();
            mountedRegistrationForm = shallow(
                <RegistrationForm {...props}/>,
                options.get()
            );
        }
        return mountedRegistrationForm;
    };
    beforeEach(() => {
        props = {
            onSubmit: jest.fn(),
            errors: {}
        };
        mountedRegistrationForm = undefined;
    });
    it("always renders a div", () => {
        const divs = registrationForm().find("div");
        expect(divs.length).toBeGreaterThan(0);
    });
    it("always renders a username input", () => {
        const usernameInput = registrationForm().find("Field[name='username']");
        expect(usernameInput.length).toBe(1);
    });
    it("always renders a password input", () => {
        const passwordInput = registrationForm().find("Field[name='password1']");
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
                const alert = registrationForm().find("Alert");
                expect(alert.length).toBe(1);
            })
        });
    });
});