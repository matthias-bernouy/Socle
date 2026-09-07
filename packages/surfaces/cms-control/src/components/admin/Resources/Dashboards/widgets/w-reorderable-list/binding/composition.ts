import type { ReorderableDefinition } from "./context";
import markup from "cms-control/static/admin/_content/sources/_runtime/detail/reorderable.html" with { type: "text" };
import { composeChoiceEditor } from "./editors";
import "./Field";

/** Only definitions determine structure; response values are applied by the page core. */
export function composeReorderable(control: HTMLElement, field: ReorderableDefinition): HTMLElement {
    const declarations = document.createElement("template");
    declarations.innerHTML = markup as unknown as string;
    const part = (name: string) =>
        declarations.content
            .querySelector<HTMLTemplateElement>(`[data-reorderable="${name}"]`)!
            .content.firstElementChild!.cloneNode(true) as HTMLElement;
    const cards = field.layout === "cards";
    const scope = `detailChoices.${field.id}`;
    control.setAttribute("layout", field.layout ?? "rows");
    control.setAttribute("item-key", field.itemKey);
    control.setAttribute("position-path", field.positionPath ?? "position");
    for (const key of ["minItems", "maxItems"] as const) {
        if (field[key] !== undefined) {
            control.setAttribute(key === "minItems" ? "min-items" : "max-items", String(field[key]));
        }
    }
    control.style.setProperty(
        "--reorderable-columns",
        ["24px", ...field.fields.map(() => "minmax(0, 1fr)"), "32px"].join(" "),
    );
    for (const label of ["", ...field.fields.map((item) => item.label), ""]) {
        const heading = document.createElement("span");
        heading.slot = "heading";
        heading.textContent = label;
        control.append(heading);
    }
    const row = part("row");
    row.setAttribute("layout", field.layout ?? "rows");
    row.setAttribute("cms-repeat", `${scope}.rows as choice`);
    const remove = part("remove");
    remove.setAttribute("cms-bind-boolean-disabled", `${scope}.removeDisabled`);
    const toolbar = cards ? part("toolbar") : undefined;
    if (toolbar) {
        toolbar.append(remove);
    }
    row.append(toolbar ?? part("handle"));
    const secondary = cards && field.fields.some((item) => item.secondary) ? part("settings") : undefined;
    for (const [index, item] of field.fields.entries()) {
        const cell = part("cell");
        cell.className = `field field-${item.type ?? "text"}`;
        if (cards && item.type !== "media") {
            cell.setAttribute("label", item.label);
        }
        cell.append(composeChoiceEditor(control, field, item, index, () => part("option")));
        (item.secondary && secondary ? secondary : row).append(cell);
    }
    if (secondary) {
        row.append(secondary);
    }
    if (!cards) {
        row.append(remove);
    }
    const add = part("add");
    add.textContent = field.addLabel ?? "Add item";
    add.setAttribute("cms-bind-boolean-disabled", `${scope}.addDisabled`);
    control.append(row, add);
    return control;
}
