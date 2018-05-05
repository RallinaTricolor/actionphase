import React from "react";
import {mount} from "enzyme";
import {MemoryRouter} from 'react-router';
import Landing from "./index";

describe("Landing", () => {
    let mountedLanding;
    const landing = () => {
        if (!mountedLanding) {
            mountedLanding = mount(
                <MemoryRouter initialEntries={['/test']}>
                    <Landing/>
                </MemoryRouter>
            );
        }
        return mountedLanding;
    };
    beforeEach(() => {
        mountedLanding = undefined;
    });
    it("always renders a div", () => {
        const divs = landing().find("div");
        expect(divs.length).toBeGreaterThan(0);
    });
    describe("the rendered div", () => {
        it("contains everything else that gets rendered", () => {
            const wrappingDiv = landing().find("div").first();
            expect(wrappingDiv.children().length).toBeGreaterThan(0);
        });
    });
    it("always renders a link to the login page", () => {
        const loginLink = landing().find("a[href='/home/login']");
        expect(loginLink.length).toBe(1);
    });
    it("always renders a link to the registration page", () => {
        const loginLink = landing().find("a[href='/home/register']");
        expect(loginLink.length).toBe(1);
    });
});