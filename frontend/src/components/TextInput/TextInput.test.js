import React from "react";
import {shallow} from "enzyme";
import {TextInput} from ".";

describe("TextInput", () => {
    it("always renders a FormGroup", () => {
        const wrapper = shallow(<TextInput />);
        expect(wrapper.find("FormGroup").length).toBe(1);
    });
});

