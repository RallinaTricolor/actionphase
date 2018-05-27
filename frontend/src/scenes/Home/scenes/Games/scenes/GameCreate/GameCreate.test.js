import React from "react";
import {mount} from "enzyme";
import GameCreate from ".";

describe("GameCreate", () => {
    let props;
    let mountedGameCreate;
    const gameCreate = () => {
        if (!mountedGameCreate) {
            mountedGameCreate = mount(
                <GameCreate {...props} />
            );
        }
        return mountedGameCreate;
    };

    beforeEach(() => {
        props = {};
        mountedGameCreate = undefined;
    });

    it("always renders a CreateForm", () => {
        const createForm = gameCreate().find("CreateForm");
        expect(createForm.length).toBe(1);
    });

});