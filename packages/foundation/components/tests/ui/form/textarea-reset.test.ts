import { afterEach, expect, test } from "bun:test";
import { P9rInput } from "../../../src/ui/Form/Inputs/P9rInput/P9rInput";
import { Textarea } from "../../../src/ui/Form/Inputs/Textarea/Textarea";

const tag = "p9r-textarea-reset";
if (!customElements.get(tag)) {
    customElements.define(tag, class extends Textarea {});
}
afterEach(() => document.body.replaceChildren());

test("textarea reset uses the current declared value after asynchronous loading", () => {
    const control = document.createElement(tag) as Textarea;
    document.body.append(control);
    control.setAttribute("value", "Loaded note");
    control.value = "Local draft";
    expect(control.getAttribute("value")).toBe("Loaded note");
    control.formResetCallback();
    expect(control.value).toBe("Loaded note");
    control.setAttribute("value", "Updated note");
    control.value = "Another draft";
    control.formResetCallback();
    expect(control.value).toBe("Updated note");
    control.removeAttribute("value");
    control.formResetCallback();
    expect(control.value).toBe("");
});

for (const type of ["text", "number"]) {
    test(`${type} input resets to the current value attribute after loading`, () => {
        const name = `p9r-input-reset-${type}`;
        if (!customElements.get(name)) {
            customElements.define(name, class extends P9rInput {});
        }
        const control = document.createElement(name) as P9rInput;
        control.setAttribute("type", type);
        document.body.append(control);
        control.setAttribute("value", "42");
        control.value = "99";
        control.formResetCallback();
        expect(control.value).toBe("42");
        control.setAttribute("value", "57");
        control.value = "99";
        control.formResetCallback();
        expect(control.value).toBe("57");
        control.removeAttribute("value");
        control.formResetCallback();
        expect(control.value).toBe("");
    });
}
