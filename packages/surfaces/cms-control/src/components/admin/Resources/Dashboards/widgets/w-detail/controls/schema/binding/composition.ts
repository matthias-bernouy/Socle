import type { DashboardField } from "@bernouy/cms-dashboards";
import markup from "cms-control/static/admin/_content/sources/_runtime/detail/schema.html" with { type: "text" };
import "./Source";
import "./Field";

type SchemaField = Extract<DashboardField, { type: "schema" }>;

export function schemaSource(field: SchemaField): HTMLElement {
    const source = document.createElement("cms-dashboard-schema-source");
    source.hidden = true;
    source.setAttribute("cms-source", "");
    source.setAttribute("field-id", field.id);
    source.setAttribute("request-base", `{{ detailSchemaUrls.${field.id} }}`);
    if (field.schema.itemsPath) {
        source.setAttribute("items-path", field.schema.itemsPath);
    }
    return source;
}

/** Definition-time composition; actual definitions and values are applied by binding. */
export function composeSchema(control: HTMLElement, field: SchemaField): void {
    const template = document.createElement("template");
    template.innerHTML = markup as unknown as string;
    const root = `detailSchemas.${field.id}`;
    for (const state of ["loading", "error", "empty", "ready"]) {
        const element = template.content.querySelector<HTMLElement>(`[data-schema-state="${state}"]`)!;
        element.setAttribute(
            "cms-condition",
            state === "empty" ? `${root}.status == 'ready' && ${root}.empty` : `${root}.status == '${state}'`,
        );
    }
    template.content.querySelector("[data-schema-row]")!.setAttribute("cms-repeat", `${root}.rows as schemaRow`);
    control.append(template.content);
}
