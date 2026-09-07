import type { WDetailField } from "../types";

export type ValueControl = HTMLElement & { value: string };
export type TokenControl = ValueControl & { values: string[] };

export function isValueControl(control: HTMLElement): control is ValueControl {
    return "value" in control && typeof (control as ValueControl).value === "string";
}

export function isTokenControl(control: HTMLElement): control is TokenControl {
    return isValueControl(control) && "values" in control && Array.isArray((control as TokenControl).values);
}
