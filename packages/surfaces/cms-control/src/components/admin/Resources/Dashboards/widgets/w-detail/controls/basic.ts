import type { WDetailField, WDetailFieldValue } from "../types";
import { parseMajorUnits } from "../../../runtime/mapping/money";
import { isTokenControl, isValueControl, type ValueControl } from "./shared";

export function readBasicControlValue(field: WDetailField, control: HTMLElement): WDetailFieldValue {
    if (field.input === "chips") {
        return Array.from(control.querySelectorAll<HTMLButtonElement>("[aria-pressed='true']"))
            .map((button) => button.dataset.value ?? "")
            .filter(Boolean);
    }
    if (field.input === "tokens" && isTokenControl(control)) {
        return control.values;
    }
    if (field.input === "checkbox" && control instanceof HTMLInputElement) {
        return control.checked;
    }
    if (field.input === "number" && isValueControl(control)) {
        if (control.value === "") {
            return "";
        }
        const value = Number(control.value);
        return Number.isFinite(value) ? value : "";
    }
    if (field.input === "money" && isValueControl(control)) {
        return readMoneyControlValue(field, control);
    }
    if (isValueControl(control)) {
        return control.value;
    }
    return Array.isArray(field.value) ? field.value : String(field.value);
}

function readMoneyControlValue(field: WDetailField, control: ValueControl): number | "" {
    const result = parseMajorUnits(control.value, field.fractionDigits ?? 2, field.allowDecimals !== false);
    if (!result.ok) {
        setMoneyError(control, result.message);
        return "";
    }
    if (field.required && result.value === "") {
        setMoneyError(control, "This field is required.");
        return "";
    }
    control.removeAttribute("invalid");
    control.removeAttribute("hint");
    control.removeAttribute("hint-level");
    return result.value;
}

function setMoneyError(control: HTMLElement, message: string): void {
    control.setAttribute("invalid", "");
    control.setAttribute("hint", message);
    control.setAttribute("hint-level", "error");
}
