import type { DashboardField } from "@bernouy/cms-dashboards";
import controls from "cms-control/static/admin/_content/sources/_runtime/detail/controls.html" with { type: "text" };
import { route } from "../../../api";
import { composeReadonly, fieldBinding } from "./readonly";
import { optionList } from "../../../runtime/mapping/fieldSupport";

export function fieldElement(field: DashboardField, root: string): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = controls as unknown as string;
    const kind = field.type === "readonly" ? (field.format ?? "readonly") : field.type;
    const control = template.content
        .querySelector<HTMLTemplateElement>(
            `[data-control="${kind === "text" && field.type === "readonly" ? "readonly" : kind}"]`,
        )!
        .content.firstElementChild!.cloneNode(true) as HTMLElement;
    const wrapper = document.createElement("cms-dashboard-detail-field");
    wrapper.setAttribute("label", field.label);
    wrapper.toggleAttribute("required", field.required === true);
    wrapper.toggleAttribute("internal-label", field.type !== "readonly");
    if (field.type === "readonly") {
        composeReadonly(control, field, root);
        wrapper.append(...Array.from(control.childNodes));
    } else {
        control.setAttribute("label", field.label);
        control.setAttribute("data-field-control", field.id);
        control.setAttribute(
            "value",
            fieldBinding(root, field.path, field.type === "tokens" ? "dashboardTokens" : undefined),
        );
        control.toggleAttribute("required", field.required === true);
        if ("placeholder" in field && field.placeholder) {
            control.setAttribute("placeholder", field.placeholder);
        }
        if (field.type === "number") {
            for (const key of ["min", "max", "step"] as const) {
                if (field[key] !== undefined) {
                    control.setAttribute(key, String(field[key]));
                }
            }
        }
        if (field.type === "textarea") {
            control.setAttribute("rows", String(field.rows ?? 4));
        }
        if (field.type === "select" || field.type === "combobox" || field.type === "tokens") {
            const options = field.type === "select" ? field.options : optionList(field.options, []);
            if (field.type === "select" && !options.some((option) => option.value === "")) {
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.disabled = true;
                placeholder.textContent = "Select an option";
                placeholder.setAttribute("cms-condition", `!${root}.${field.path}`);
                control.append(placeholder);
            }
            for (const item of options) {
                const option = document.createElement("option");
                option.value = item.value;
                option.textContent = item.label;
                control.append(option);
            }
            if (field.type !== "select") {
                control.toggleAttribute("creatable", field.allowCustom === true);
                control.setAttribute("placeholder", "");
            }
        }
        if (field.type === "secret-ref") {
            control.setAttribute("api", route("/api/secrets"));
        }
        if (field.type === "page-link") {
            control.setAttribute("allow-external", String(field.allowExternal === true));
            control.setAttribute("allow-media", String(field.allowMedia === true));
            control.setAttribute("published-only", String(field.publishedOnly === true));
        }
        wrapper.append(control);
    }
    return wrapper;
}
