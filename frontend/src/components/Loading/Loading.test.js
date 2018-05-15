import React from "react";
import {shallow} from "enzyme";
import {Loading} from '.';

describe("Loading", () => {
    it("always renders a div", () => {
        const wrapper = shallow(<Loading />);
        expect(wrapper.find("div").length).toBe(1);
    });
});

