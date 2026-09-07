import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { CMS_BINDING_ATTRIBUTES, type SettingControl } from "@bernouy/cms-content/editor";
import {
    createNativeEditorCatalog,
    isNativeEditorAttributeAllowed,
    isNativeEditorAttributeMutationAllowed,
    isNativeEditorAttributeValueAllowed,
    isNativeEditorSettingValueAllowed,
} from "@bernouy/cms-editor-system-v2";
import { ShellSelection } from "../../src/components/Layout/Shell/Controller/shellSelection";
import { removeSource } from "../../src/components/Layout/Shell/Domain/Mutations/Bindings/sourceBindings";

function fixture() {
    const { document, HTMLElement } = parseHTML(
        '<form cms-source="/api/update" cms-source-method="PATCH" cms-source-trigger="submit"></form>',
    );
    const target = document.querySelector<HTMLFormElement>("form")!;
    const entry = createNativeEditorCatalog(HTMLElement as unknown as CustomElementConstructor).find(
        (item) => item.tag === "form",
    )!;
    const editor = new entry.editor(target);
    const setting = (attribute: string) =>
        editor
            .getSettings()
            .flatMap((section) => section.settings)
            .find((item) => item.type !== "row" && item.attribute === attribute) as SettingControl;
    return { target, editor, setting };
}

describe("native form binding settings", () => {
    test("authors typed serialization as an opt-in and can restore standard serialization", () => {
        const { target, editor, setting } = fixture();
        const control = setting(CMS_BINDING_ATTRIBUTES.sourceSerialization);
        const selection = new ShellSelection({ runtime: () => null } as never);
        expect(control).toMatchObject({ type: "select", defaultValue: "" });
        expect(isNativeEditorSettingValueAllowed(target, control, "json")).toBe(false);
        selection.applySetting(editor, control, "typed-json");
        expect(target.getAttribute(CMS_BINDING_ATTRIBUTES.sourceSerialization)).toBe("typed-json");
        selection.applySetting(editor, control, "");
        expect(target.hasAttribute(CMS_BINDING_ATTRIBUTES.sourceSerialization)).toBe(false);
        target.setAttribute(CMS_BINDING_ATTRIBUTES.sourceMethod, "GET");
        expect(isNativeEditorSettingValueAllowed(target, control, "typed-json")).toBe(false);
    });

    test("rejects combined mutations that would enable typed JSON on a GET form", () => {
        const { target } = fixture();
        target.setAttribute(CMS_BINDING_ATTRIBUTES.sourceSerialization, "typed-json");
        expect(
            isNativeEditorAttributeMutationAllowed(target, {
                [CMS_BINDING_ATTRIBUTES.sourceMethod]: "GET",
            }),
        ).toBe(false);
        expect(
            isNativeEditorAttributeMutationAllowed(target, {
                [CMS_BINDING_ATTRIBUTES.sourceMethod]: "GET",
                [CMS_BINDING_ATTRIBUTES.sourceSerialization]: "",
            }),
        ).toBe(true);
    });

    test("restricts reload setting values to a literal source element id", () => {
        const { target, editor, setting } = fixture();
        const control = setting(CMS_BINDING_ATTRIBUTES.sourceSuccessReload);
        const selection = new ShellSelection({ runtime: () => null } as never);
        for (const value of ["#detail .child", "#a,#b", "{{ target }}", "#detail:has(input)"]) {
            expect(isNativeEditorSettingValueAllowed(target, control, value)).toBe(false);
            expect(isNativeEditorAttributeValueAllowed("form", control.attribute, value)).toBe(false);
        }
        selection.applySetting(editor, control, "#detail");
        expect(target.getAttribute(control.attribute)).toBe("#detail");
        selection.applySetting(editor, control, "");
        expect(target.hasAttribute(control.attribute)).toBe(false);
        expect(isNativeEditorAttributeAllowed("section", control.attribute)).toBe(false);
        expect(isNativeEditorAttributeAllowed("form", "cms-source-success-update")).toBe(false);
    });

    test("removes submission settings when removing a source", () => {
        const { target, editor } = fixture();
        target.setAttribute(CMS_BINDING_ATTRIBUTES.sourceSerialization, "typed-json");
        target.setAttribute(CMS_BINDING_ATTRIBUTES.sourceSuccessReload, "#detail");
        expect(removeSource(editor, () => true)).toBe(true);
        expect(target.hasAttribute(CMS_BINDING_ATTRIBUTES.sourceSerialization)).toBe(false);
        expect(target.hasAttribute(CMS_BINDING_ATTRIBUTES.sourceSuccessReload)).toBe(false);
    });
});
