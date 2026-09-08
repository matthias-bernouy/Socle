import { ValidatableFormControlElement } from "../../Structure/ValidatableFormControlElement";
import { InputValidityController } from "../P9rInput/validity";
import { syncAll } from "../P9rInput/sync";
import { handleEnterSubmit } from "../P9rInput/listener";
import { currencyFractionDigits, formatMinorUnits, parseMajorUnits } from "./amount";
import template from "../P9rInput/ui/template.html" with { type: "text" };
import base from "../P9rInput/ui/styles/base.css" with { type: "text" };
import help from "../P9rInput/ui/styles/help.css" with { type: "text" };
import variant from "../P9rInput/ui/styles/variant.css" with { type: "text" };
import responsive from "../P9rInput/ui/styles/responsive.css" with { type: "text" };

/** Displays major units; value and native form submissions contain integer minor units. */
export class MoneyInput extends ValidatableFormControlElement {
    static observedAttributes = [
        "value",
        "currency",
        "allow-decimals",
        "label",
        "aria-label",
        "placeholder",
        "required",
        "disabled",
        "readonly",
        "error",
        "hint",
        "hint-level",
    ];
    private readonly input: HTMLInputElement;
    private readonly feedback: InputValidityController;
    private canonical = "";
    private dirty = false;
    private fieldsetDisabled = false;

    constructor() {
        super({ css: base + help + variant + responsive, template: template as unknown as string });
        const root = this.shadowRoot!;
        this.input = root.querySelector("input")!;
        this.feedback = new InputValidityController(this, this._internals, {
            input: this.input,
            hint: root.querySelector(".hint"),
            error: root.querySelector(".error"),
            meta: root.querySelector(".meta"),
            counter: root.querySelector(".counter"),
        });
        this.input.addEventListener("input", this.onEdit);
        this.input.addEventListener("change", () => {
            this.onEdit();
            this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        });
        this.input.addEventListener("keydown", (event) => handleEnterSubmit(this, this.input, this._internals, event));
    }

    override connectedCallback(): void {
        this.syncPresentation();
        this.feedback.connect();
        if (Object.hasOwn(this, "value")) {
            const value = this.value;
            delete (this as { value?: string }).value;
            this.value = value;
        } else if (!this.dirty) {
            this.renderValue(this.getAttribute("value") ?? "");
        }
    }

    disconnectedCallback(): void {
        this.feedback.disconnect();
    }

    attributeChangedCallback(name: string, old: string | null, value: string | null): void {
        if (!this.input || old === value) {
            return;
        }
        if (name === "value") {
            this.value = value ?? "";
        } else {
            this.syncPresentation();
            if (name === "currency" || name === "allow-decimals") {
                if (!this.dirty) {
                    this.renderValue(this.canonical);
                } else {
                    this.onEdit();
                }
            }
        }
    }

    get value(): string {
        return this.canonical;
    }
    set value(value: string) {
        const next = value == null ? "" : String(value);
        // A repeated bound value must not erase an unfinished edit or move its caret.
        if (this.dirty && next === this.canonical) {
            return;
        }
        this.renderValue(next);
    }
    get name(): string {
        return this.getAttribute("name") ?? "";
    }
    get disabled(): boolean {
        return this.input.disabled;
    }
    set disabled(value: boolean) {
        this.toggleAttribute("disabled", value);
    }
    get required(): boolean {
        return this.hasAttribute("required");
    }
    set required(value: boolean) {
        this.toggleAttribute("required", value);
    }
    override focus(): void {
        this.input.focus();
    }
    formResetCallback(): void {
        this.renderValue(this.getAttribute("value") ?? "");
        this.feedback.reset();
    }
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
        this.syncPresentation();
    }
    formStateRestoreCallback(state: string | File | FormData): void {
        if (typeof state === "string") {
            this.input.value = state;
            this.onEdit();
        }
    }

    private get decimals(): boolean {
        return this.getAttribute("allow-decimals") !== "false";
    }
    private get fractionDigits(): number {
        return currencyFractionDigits(this.getAttribute("currency") ?? undefined);
    }

    private renderValue(value: string): void {
        this.dirty = false;
        this.input.value = formatMinorUnits(value, this.fractionDigits, this.decimals);
        this.updateValue();
    }
    private readonly onEdit = (): void => {
        this.dirty = true;
        this.updateValue();
    };
    private updateValue(): void {
        const result = parseMajorUnits(this.input.value, this.fractionDigits, this.decimals);
        this.canonical = result.ok ? String(result.value) : "";
        this.input.setCustomValidity(result.ok ? "" : result.message);
        this._internals.setFormValue(this.canonical, this.input.value);
        this.toggleAttribute("invalid", !result.ok);
        this.feedback.sync();
    }
    private syncPresentation(): void {
        syncAll(this, this.input, this.shadowRoot!.querySelector(".label"), null, null);
        this.input.type = "text";
        this.input.inputMode = this.decimals && this.fractionDigits > 0 ? "decimal" : "numeric";
        this.input.disabled = this.hasAttribute("disabled") || this.fieldsetDisabled;
        this.feedback.sync();
    }
    protected syncValidity(): void {
        this.feedback.sync();
    }
    protected get controlValidity(): ValidityState {
        return this.feedback.validity;
    }
    protected get controlValidationMessage(): string {
        return this.feedback.validationMessage;
    }
}
