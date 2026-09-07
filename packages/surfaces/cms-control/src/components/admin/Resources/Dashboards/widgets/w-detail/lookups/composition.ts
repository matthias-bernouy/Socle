import { lookupUsesOffsetPagination } from "../../../runtime/lookups";
import type { DashboardEmbeddedLookupRef, DashboardField } from "@bernouy/cms-dashboards";
import templates from "cms-control/static/admin/_content/sources/_runtime/detail/lookup.html" with { type: "text" };
import "./Lookup";

type LookupField = Extract<DashboardField, { type: "combobox" | "tokens" }>;

/** Declares a source and a repeat; response values never enter composition. */
export function composeLookup(control: HTMLElement, field: LookupField): HTMLElement {
    const lookup = field.lookup!;
    const host = lookupSource(lookup, field.id);
    host.setAttribute("selected-value", control.getAttribute("value") ?? "");
    const declared = document.createElement("span");
    declared.hidden = true;
    declared.setAttribute("data-static-options", "");
    declared.append(...Array.from(control.children));
    host.append(declared);
    control.setAttribute("value", "{{ lookupValue }}");
    if (field.type === "combobox") {
        control.toggleAttribute("remote-search", Boolean(host.getAttribute("search-params")));
        control.setAttribute("loading", "{{ $source.loading }}");
        control.setAttribute("has-more", "{{ lookupHasMore }}");
    }
    control.toggleAttribute("creatable", Boolean(field.allowCustom || lookup.create?.mode === "inline"));
    const template = document.createElement("template");
    template.innerHTML = templates as unknown as string;
    control.append(
        template.content.querySelector<HTMLTemplateElement>('[data-lookup="options"]')!.content.cloneNode(true),
    );
    host.append(
        control,
        template.content.querySelector<HTMLTemplateElement>('[data-lookup="states"]')!.content.cloneNode(true),
    );
    return host;
}

export function lookupSource(lookup: DashboardEmbeddedLookupRef, path: string, root = "detailLookupUrls"): HTMLElement {
    const host = document.createElement("cms-dashboard-lookup");
    host.setAttribute("cms-source", "");
    host.setAttribute("request-base", `{{ ${root}.${path} }}`);
    host.setAttribute("resource-path", "{{ detailResourcePath }}");
    for (const [attribute, value] of Object.entries({
        "items-path": lookup.itemsPath,
        "value-path": lookup.valuePath,
        "label-path": lookup.labelPath,
        "total-path": lookup.totalPath,
        "selected-expression": lookup.selected,
    })) {
        if (typeof value === "string") {
            host.setAttribute(attribute, value);
        }
    }
    for (const [attribute, expression] of [
        ["search-params", "$search"],
        ["offset-params", "$offset"],
    ] as const) {
        host.setAttribute(
            attribute,
            Object.entries(lookup.params ?? {})
                .filter(([, value]) => value === expression)
                .map(([key]) => key)
                .join(" "),
        );
    }
    if (!lookupUsesOffsetPagination(lookup)) {
        host.removeAttribute("offset-params");
    }
    return host;
}
