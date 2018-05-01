import React from "react";
import {mount} from "enzyme";
import {TextInput} from ".";

describe("TextInput", () => {

    let props;
    let mountedTextInput;
    const textInput = () => {
        if (!mountedTextInput) {
            mountedTextInput = mount(
                <TextInput {...props} />
            );
        }
        return mountedTextInput;
    };

    beforeEach(() => {
        props = {};
        mountedTextInput = undefined;
    });

    it("always renders a FormGroup", () => {
        const formGroup = textInput().find("FormGroup");
        expect(formGroup.length).toBe(1);
    });
});

