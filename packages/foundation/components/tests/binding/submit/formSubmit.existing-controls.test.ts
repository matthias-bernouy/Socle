import { afterEach, expect, test } from "bun:test";
import { applyControlAttribute } from "../../../src/binding/reactive/controls/value";
import { serializeTypedForm } from "../../../src/binding/submit/typed/serialize";
import { TokenInput } from "../../../src/ui/Form/Inputs/TokenInput/TokenInput";
import { Switch } from "../../../src/ui/Form/Toggles/Switch/Switch";
import { resetDom } from "../testUtils";
import { form } from "./formTestUtils";

class ExistingTokenControl extends TokenInput {}
class ExistingSwitchControl extends Switch {}
customElements.define("test-existing-token-control", ExistingTokenControl);
customElements.define("test-existing-switch-control", ExistingSwitchControl);
afterEach(resetDom);

test("tokens retain their existing value contract when bound and submitted", () => {
    const target = form('<form><test-existing-token-control name="tags"></test-existing-token-control></form>');
    const control = target.firstElementChild as ExistingTokenControl;
    target.append(control);
    applyControlAttribute(control, "value", ["tennis", "padel"]);
    expect(control.value).toBe("tennis,padel");
    expect(control.values).toEqual(["tennis", "padel"]);
    expect(serializeTypedForm(target)).toEqual({ tags: "tennis,padel" });
    control.value = "tennis,squash";
    const token = control.shadowRoot!.querySelector("[data-tokens]")!.firstElementChild;
    applyControlAttribute(control, "value", "tennis,squash");
    expect(control.shadowRoot!.querySelector("[data-tokens]")!.firstElementChild).toBe(token);
    expect(serializeTypedForm(target)).toEqual({ tags: "tennis,squash" });
    applyControlAttribute(control, "value", []);
    expect(control.value).toBe("");
    expect(serializeTypedForm(target)).toEqual({ tags: "" });
});

test("switches use checked without replacing their submission value", () => {
    const target = form(
        '<form><test-existing-switch-control name="enabled" value="published"></test-existing-switch-control></form>',
    );
    const control = target.firstElementChild as ExistingSwitchControl;
    target.append(control);
    applyControlAttribute(control, "checked", true);
    expect(control.checked).toBe(true);
    expect(control.value).toBe("published");
    expect(serializeTypedForm(target)).toEqual({ enabled: true });
    applyControlAttribute(control, "checked", false);
    expect(control.checked).toBe(false);
    expect(control.value).toBe("published");
    expect(serializeTypedForm(target)).toEqual({ enabled: false });
});

test("native multiple selections remain arrays and ordinary commas remain text", () => {
    const target = form(`<form>
        <select name="sports" multiple><option value="tennis">Tennis</option><option value="padel">Padel</option></select>
        <input name="label" value="one,two">
        <input type="number" name="quantity" value="0">
    </form>`);
    const select = target.querySelector("select")!;
    for (const option of Array.from(select.options)) {
        option.selected = true;
    }
    expect(serializeTypedForm(target)).toEqual({ sports: ["tennis", "padel"], label: "one,two", quantity: 0 });
    for (const option of Array.from(select.options)) {
        option.selected = false;
    }
    expect(serializeTypedForm(target)).toEqual({ sports: [], label: "one,two", quantity: 0 });
});

test("associated controls outside the form are read through their existing properties", () => {
    const target = form(
        '<form id="existing-control-form"></form><test-existing-token-control form="existing-control-form" name="tags" value="padel"></test-existing-token-control>',
    );
    expect(serializeTypedForm(target)).toEqual({ tags: "padel" });
});
