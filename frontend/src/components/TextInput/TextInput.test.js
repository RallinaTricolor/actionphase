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
        props = {
            name: undefined,
            label: undefined,
            error: undefined,
            type: undefined
        };
        mountedTextInput = undefined;
    });

    it("always renders a FormGroup", () => {
        const formGroup = textInput().find("FormGroup");
        expect(formGroup.length).toBe(1);
    });
    describe("the rendered FormGroup", () => {
        it("contains everything else that gets rendered", () => {
            const formGroup = textInput().find("FormGroup").first();
            expect(formGroup.children().length).toBeGreaterThan(0);
        });
    });
    it("always renders an Input", () => {
        expect(textInput().find("Input").length).toBe(1);
    });
    describe("the rendered Input", () => {
        it("receives props from TextInput", () => {
            const input = textInput().find("Input");
            expect(Object.keys(input.props()).length).toBeGreaterThan(0);
        });
        it("has a default type of 'text'", () => {
            const input = textInput().find("Input").first();
            expect(input.prop('type')).toBe("text");
        });
    });
});

