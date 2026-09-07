import type { RenderContext } from "../../../domain";
import { configureForm, formPart } from "../../../runtime/actions/forms/views/composition";
import { directoryElement } from "../lookups/users";
import { schemaSource } from "../controls/schema/binding/composition";
import type { DashboardNavigationListWidget, DashboardSection } from "@bernouy/cms-dashboards";
import type { DetailWidget } from "../runtime/fieldState";
import { composeActions } from "./actions";
import { fieldElement } from "./fields";
import "./Field";

/** Compose declarations once, before cms-source compiles; never receives response data. */
export function composeDetail(
    widget: DetailWidget,
    context?: RenderContext,
    navigation?: (widget: DashboardNavigationListWidget) => HTMLElement,
): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const root = "detailValues";
    const title = document.createElement("span");
    title.slot = "bound-title";
    title.setAttribute("cms-condition", "detailReady");
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
    fragment.append(composeActions());
    let form: HTMLFormElement | undefined;
    if (widget.save) {
        if (!context) {
            throw new Error("Detail forms require their source context.");
        }
        form = formPart<HTMLFormElement>("save");
        configureForm(form, widget.save, context);
        const button = formPart<HTMLElement>("submit");
        button.slot = "bound-actions";
        button.setAttribute("form", form.getAttribute("id")!);
        button.setAttribute("cms-condition", "detailReady");
        button.textContent = widget.save.label ?? "Save";
        fragment.append(button, form);
    }
    for (const section of [...widget.main, ...(widget.aside ?? [])]) {
        if (!("widget" in section)) {
            fragment.append(...section.fields.filter((field) => field.type === "schema").map(schemaSource));
        }
    }
    if (
        [...widget.main, ...(widget.aside ?? [])].some(
            (section) => !("widget" in section) && section.fields.some((field) => field.type === "cms-user"),
        )
    ) {
        fragment.append(directoryElement());
    }
    for (const [slot, sections] of [
        ["bound-main", widget.main],
        ["bound-aside", widget.aside ?? []],
    ] as const) {
        for (const section of sections) {
            if ("widget" in section) {
                if (!navigation) {
                    throw new Error("Detail navigation must be composed with its source context.");
                }
                const child = navigation(section);
                child.slot = slot;
                // Its source depends on selection, so fetch it alongside the parent.
                child.setAttribute("data-detail-ready", "{{ detailReady }}");
                if (form) {
                    child.removeAttribute("slot");
                    form.querySelector("[data-form-main]")!.append(child);
                } else {
                    fragment.append(child);
                }
            } else {
                const element = sectionElement(section, slot, root, widget.save);
                if (form) {
                    element.removeAttribute("slot");
                    form.querySelector(slot === "bound-main" ? "[data-form-main]" : "[data-form-aside]")!.append(
                        element,
                    );
                } else {
                    fragment.append(element);
                }
            }
        }
    }
    return fragment;
}

function sectionElement(
    section: DashboardSection,
    slot: string,
    root: string,
    form?: { valuesPath?: string },
): HTMLElement {
    const element = document.createElement("cms-detail-section");
    element.slot = slot;
    element.setAttribute("heading", section.title);
    element.setAttribute("cms-condition", "detailReady");
    if (section.description) {
        element.setAttribute("description", section.description);
    }
    if (slot === "bound-aside") {
        element.setAttribute("density", "compact");
    }
    const stack = document.createElement("p9r-stack");
    stack.setAttribute("gap", "md");
    stack.setAttribute("trim", "");
    stack.append(...section.fields.map((field) => fieldElement(field, root, form)));
    element.append(stack);
    return element;
}

function binding(root: string, path: string): string {
    return `{{ ${path === "." ? root : `${root}.${path}`} }}`;
}
