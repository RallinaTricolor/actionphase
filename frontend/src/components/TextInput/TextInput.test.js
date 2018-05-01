import React from "react";
import {mount} from "enzyme";
import TextInput from ".";

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
            name: 'test',
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
        it("has the 'name' property matching the prop", () => {
            const input = textInput().find("Input");
            expect(input.prop('name')).toBe(props.name);
        });
        it("has the 'id' property set to to 'id_$name'", () => {
            const input = textInput().find("Input");
            expect(input.prop('id')).toBe('id_' + props.name);
        });
    });
    describe("when 'label' is undefined", () => {
        it('does not render a Label', () => {
            const label = textInput().find("Label");
            expect(label.length).toBe(0);
        });
    });
    describe("when 'label' is defined", () => {
        beforeEach(() => {
            props.label = 'test';
        });
        it("causes a Label to be rendered", () => {
            const label = textInput().find("Label");
            expect(label.length).toBeGreaterThan(0);
        });
        describe("the rendered Label", () => {
            it("has a 'for' attribute equal to the Input's 'id'", () => {
                const label = textInput().find("Label");
                const input = textInput().find("Input");
                expect(label.prop('htmlFor')).toBe(input.prop('id'));
            });
        });
    });
    describe("when 'error' is undefined", () => {
        it('does not render a FormFeedback', () => {
            const label = textInput().find("FormFeedback");
            expect(label.length).toBe(0);
        });
    });
    describe("when 'error' is defined", () => {
        beforeEach(() => {
            props.error = 'test';
        });
        it("causes a FormFeedback to be rendered", () => {
            const error = textInput().find("FormFeedback");
            expect(error.length).toBeGreaterThan(0);
        });
        describe("the rendered FormFeedback", () => {
            it("has a html equal to the 'error' prop", () => {
                const error = textInput().find("FormFeedback");
                expect(error.text()).toBe(props.error);
            });
        });
    });
    describe("when 'type' is undefined", () => {
        it("gives the Input a default type of 'text'", () => {
            const input = textInput().find("Input");
            expect(input.prop('type')).toBe("text");
        });
    });
    describe("when 'type' is defined", () => {
        beforeEach(() => {
            props.type = 'checkbox';
        });
        it("sets the Input's type attribute to the prop", () => {
            const input = textInput().find("Input");
            expect(input.prop('type')).toBe(props.type);
        });
    });
});

