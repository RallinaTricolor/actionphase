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
});