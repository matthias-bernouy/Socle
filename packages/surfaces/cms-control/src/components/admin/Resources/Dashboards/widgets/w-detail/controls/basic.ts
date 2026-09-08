import type { WDetailField, WDetailFieldValue } from "../types";
import { isTokenControl, isValueControl } from "./shared";

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
    if ((field.input === "number" || field.input === "money") && isValueControl(control)) {
        if (control.value === "") {
            return "";
        }
        const value = Number(control.value);
        return Number.isFinite(value) ? value : "";
    }
    if (isValueControl(control)) {
        return control.value;
    }
    return Array.isArray(field.value) ? field.value : String(field.value);
}
