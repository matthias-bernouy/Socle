import type { DashboardReorderableListItemField } from "@bernouy/cms-dashboards";
import type { ReorderableDefinition } from "./context";
import { route } from "../../../api";
import { lookupSource } from "../../w-detail/lookups/composition";
import { composeMedia } from "../../w-media-field/binding/composition";
import markup from "cms-control/static/admin/_content/sources/_runtime/detail/controls.html" with { type: "text" };

export function composeChoiceEditor(
    parent: HTMLElement,
    definition: ReorderableDefinition,
    field: DashboardReorderableListItemField,
    index: number,
    optionTemplate: () => HTMLElement,
): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = markup as unknown as string;
    const editor = template.content
        .querySelector<HTMLTemplateElement>(`[data-control="${field.type ?? "text"}"]`)!
        .content.firstElementChild!.cloneNode(true) as HTMLElement;
    editor.setAttribute("data-item-index", "{{ choice.index }}");
    editor.setAttribute("data-item-field", field.id);
    editor.setAttribute("data-item-path", field.path);
    editor.setAttribute("aria-label", field.label);
    editor.toggleAttribute("required", field.required === true);
    if (field.placeholder) {
        editor.setAttribute("placeholder", field.placeholder);
    }
    if (field.type === "checkbox") {
        editor.setAttribute("cms-bind-value", `choice.cells.${field.id}`);
    } else if (field.type !== "media") {
        editor.setAttribute("value", `{{ choice.cells.${field.id} }}`);
    }
    if (field.type === "media") {
        editor.setAttribute("label", field.label);
        editor.setAttribute("layout", "card");
        editor.setAttribute("accept", "image/*");
        composeMedia(editor, field, `choice.media.${field.id}`);
    }
    if (field.type === "secret-ref") {
        editor.setAttribute("label", field.label);
        editor.setAttribute("api", route("/api/secrets"));
    }
    if (field.type === "page-link") {
        editor.setAttribute("label", field.label);
        for (const [attribute, value] of [
            ["allow-external", field.allowExternal],
            ["allow-media", field.allowMedia],
            ["published-only", field.publishedOnly],
        ] as const) {
            editor.setAttribute(attribute, String(value === true));
        }
    }
    for (const option of field.options ?? []) {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        editor.append(element);
    }
    if (field.type === "combobox" && field.lookup) {
        const source = lookupSource(field.lookup, `${definition.id}.${field.id}`, "detailChoiceLookupUrls");
        const scope = `choiceLookup_${definition.id}_${index}`;
        source.setAttribute("context-name", scope);
        source.setAttribute("item-field", field.id);
        const declared = document.createElement("span");
        declared.hidden = true;
        declared.setAttribute("data-static-options", "");
        declared.append(...Array.from(editor.children));
        source.hidden = true;
        source.append(declared);
        parent.append(source);
        const option = optionTemplate();
        option.setAttribute("cms-repeat", `${scope}.lookupOptions as choiceOption`);
        editor.append(option);
        editor.toggleAttribute("remote-search", Boolean(source.getAttribute("search-params")));
        editor.toggleAttribute("remote-pagination", Boolean(source.getAttribute("offset-params")));
        editor.setAttribute("loading", `{{ ${scope}.lookupLoading }}`);
        editor.setAttribute("has-more", `{{ ${scope}.lookupHasMore }}`);
    }
    return editor;
}
