import React from "react";
import {mount} from "enzyme";
import FormInput from ".";

describe("FormInput", () => {

    let props;
    let mountedFormInput;
    const formInput = () => {
        if (!mountedFormInput) {
            mountedFormInput = mount(
                <FormInput {...props} />
            );
        }
        return mountedFormInput;
    };

    beforeEach(() => {
        props = {
            name: 'test',
            label: undefined,
            error: undefined,
            type: undefined,
            text: undefined
        };
        mountedFormInput = undefined;
    });

    it("always renders a FormGroup", () => {
        const formGroup = formInput().find("FormGroup");
        expect(formGroup.length).toBe(1);
    });
    describe("the rendered FormGroup", () => {
        it("contains everything else that gets rendered", () => {
            const formGroup = formInput().find("FormGroup").first();
            expect(formGroup.children().length).toBeGreaterThan(0);
        });
    });
    it("always renders an Input", () => {
        expect(formInput().find("Input").length).toBe(1);
    });
    describe("the rendered Input", () => {
        it("receives props from FormInput", () => {
            const input = formInput().find("Input");
            expect(Object.keys(input.props()).length).toBeGreaterThan(0);
        });
        it("has the 'name' property matching the prop", () => {
            const input = formInput().find("Input");
            expect(input.prop('name')).toBe(props.name);
        });
        it("has the 'id' property set to to 'id_$name'", () => {
            const input = formInput().find("Input");
            expect(input.prop('id')).toBe('id_' + props.name);
        });
    });
    describe("when 'label' is undefined", () => {
        it('does not render a Label', () => {
            const label = formInput().find("Label");
            expect(label.length).toBe(0);
        });
    });
    describe("when 'label' is defined", () => {
        beforeEach(() => {
            props.label = 'test';
        });
        it("causes a Label to be rendered", () => {
            const label = formInput().find("Label");
            expect(label.length).toBeGreaterThan(0);
        });
        describe("the rendered Label", () => {
            it("has a 'for' attribute equal to the Input's 'id'", () => {
                const label = formInput().find("Label");
                const input = formInput().find("Input");
                expect(label.prop('htmlFor')).toBe(input.prop('id'));
            });
        });
    });
    describe("when 'error' is undefined", () => {
        it('does not render a FormFeedback', () => {
            const label = formInput().find("FormFeedback");
            expect(label.length).toBe(0);
        });
    });
    describe("when 'error' is defined", () => {
        beforeEach(() => {
            props.error = 'test';
        });
        it("causes a FormFeedback to be rendered", () => {
            const error = formInput().find("FormFeedback");
            expect(error.length).toBeGreaterThan(0);
        });
        describe("the rendered FormFeedback", () => {
            it("has a html equal to the 'error' prop", () => {
                const error = formInput().find("FormFeedback");
                expect(error.text()).toBe(props.error);
            });
        });
    });
    describe("when 'type' is undefined", () => {
        it("gives the Input a default type of 'text'", () => {
            const input = formInput().find("Input");
            expect(input.prop('type')).toBe("text");
        });
    });
    describe("when 'type' is defined", () => {
        beforeEach(() => {
            props.type = 'checkbox';
        });
        it("sets the Input's type attribute to the prop", () => {
            const input = formInput().find("Input");
            expect(input.prop('type')).toBe(props.type);
        });
    });
    describe("when 'text' is defined", () => {
        beforeEach(() => {
            props.text = 'Test Text';
        });
        it("renders a FormText component", () => {
            const text = formInput().find("FormText");
            expect(text.length).toBeGreaterThan(0);
        });
        describe("the rendered FormText", () => {
            it("has the text passed by the prop", () => {
                const text = formInput().find("FormText");
                expect(text.text()).toBe(props.text);
            });
        });
    });
    describe("when extra props are passed", () => {
        beforeEach(() => {
            props.onChange = jest.fn();
        });
        it("sets those props on the Input", () => {
            const input = formInput().find("Input");
            expect(input.prop('onChange')).toBe(props.onChange);
        });
    });
});

