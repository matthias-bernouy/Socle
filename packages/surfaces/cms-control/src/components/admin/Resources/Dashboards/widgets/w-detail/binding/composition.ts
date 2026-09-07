import type { DashboardSection } from "@bernouy/cms-dashboards";
import type { DetailWidget } from "../runtime/fieldState";
import { renderDetailActions } from "../runtime/actions";
import { fieldElement } from "./fields";
import "./Field";

const supported = new Set([
    "text",
    "number",
    "textarea",
    "select",
    "secret-ref",
    "page-link",
    "readonly",
    "combobox",
    "tokens",
    "checkbox",
    "money",
]);

/** Temporary migration boundary; extend it as the remaining control families migrate. */
export function supportsBoundDetail(widget: DetailWidget): boolean {
    return (
        [...widget.main, ...(widget.aside ?? [])].every(
            (section) =>
                !("widget" in section) &&
                section.fields.every(
                    (field) =>
                        supported.has(field.type) &&
                        !field.visibleWhen &&
                        !("lookup" in field && field.lookup) &&
                        !(field.type === "money" && typeof field.allowDecimals === "object"),
                ),
        ) && !(widget.actions ?? []).some((action) => action.visibleWhen)
    );
}

/** Compose declarations once, before cms-source compiles; never receives response data. */
export function composeDetail(widget: DetailWidget): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const root = widget.source.itemPath ? `dashboardData.${widget.source.itemPath}` : "dashboardData";
    const title = document.createElement("span");
    title.slot = "bound-title";
    if (widget.title?.path) {
        const path = widget.title.path === "." ? root : `${root}.${widget.title.path}`;
        const present = `${path} || ${path} == 0 || ${path} == false`;
        const value = document.createElement("span");
        value.setAttribute("cms-condition", present);
        value.textContent = binding(root, widget.title.path);
        const fallback = document.createElement("span");
        fallback.setAttribute("cms-condition", `!${path} && ${path} != 0 && ${path} != false`);
        fallback.textContent = widget.title.fallback ?? widget.id;
        title.append(value, fallback);
    } else {
        title.textContent = widget.title?.fallback ?? widget.id;
    }
    fragment.append(title);
    for (const action of renderDetailActions(
        (widget.actions ?? []).map((action) => ({ ...action, action: action.id, icon: undefined })),
    )) {
        action.slot = "bound-actions";
        action.dataset.widget = widget.id;
        action.setAttribute("cms-condition", "$source.loaded || $source.empty");
        fragment.append(action);
    }
    for (const [slot, sections] of [
        ["bound-main", widget.main],
        ["bound-aside", widget.aside ?? []],
    ] as const) {
        for (const section of sections) {
            if ("widget" in section) {
                continue;
            }
            fragment.append(sectionElement(section, slot, root));
        }
    }
    return fragment;
}

function sectionElement(section: DashboardSection, slot: string, root: string): HTMLElement {
    const element = document.createElement("cms-detail-section");
    element.slot = slot;
    element.setAttribute("heading", section.title);
    element.setAttribute("cms-condition", "$source.loaded || $source.empty");
    if (section.description) {
        element.setAttribute("description", section.description);
    }
    if (slot === "bound-aside") {
        element.setAttribute("density", "compact");
    }
    const stack = document.createElement("p9r-stack");
    stack.setAttribute("gap", "md");
    stack.setAttribute("trim", "");
    stack.append(...section.fields.map((field) => fieldElement(field, root)));
    element.append(stack);
    return element;
}

function binding(root: string, path: string): string {
    return `{{ ${path === "." ? root : `${root}.${path}`} }}`;
}
