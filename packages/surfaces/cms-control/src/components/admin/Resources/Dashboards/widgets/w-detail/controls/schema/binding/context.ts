import type { DashboardField } from "@bernouy/cms-dashboards";
import { sourceUrl } from "../../../../../runtime/source";
import { schemaDefinitions, recordValue } from "../../../../../runtime/mapping/fieldSupport";
import { schemaDependenciesResolved } from "../../../runtime/schemas/dependencies";
import type { WDetailSchemaDefinition } from "../../../types";
import { boundSchemas } from "./data";

type SchemaRow = WDetailSchemaDefinition & {
    checkbox: boolean;
    select: boolean;
    text: boolean;
    value: string;
    checked: boolean;
    placeholder: boolean;
    inputType: string;
};

/** Stable row projections let ordinary repeats refresh values without replacing active inputs. */
export function schemaContext(host: HTMLElement, fields: DashboardField[]) {
    const schemas = fields.filter((field) => field.type === "schema");
    const rows = new WeakMap<WDetailSchemaDefinition, SchemaRow>();
    return (values: Record<string, unknown>, resource: unknown) => {
        const data = boundSchemas(host);
        return {
            detailSchemaUrls: Object.fromEntries(
                schemas.map((field) => [
                    field.id,
                    resource != null && schemaDependenciesResolved(field, resource, values)
                        ? sourceUrl(host.dataset.sourceId ?? "", field.schema, { fields: values, resource }).href
                        : "",
                ]),
            ),
            detailSchemas: Object.fromEntries(
                schemas.map((field) => {
                    const schema = data[field.id];
                    const definitions = schemaDefinitions(field, values, schema?.definitions ?? []);
                    const current = recordValue(values[field.id]);
                    const projected = definitions.map((definition) => {
                        let row = rows.get(definition);
                        if (!row) {
                            row = {
                                ...definition,
                                required: definition.required === true,
                                checkbox: definition.type === "boolean",
                                select: definition.type !== "boolean" && Boolean(definition.options?.length),
                                text: definition.type !== "boolean" && !definition.options?.length,
                                inputType: definition.type === "number" ? "number" : "text",
                                value: "",
                                checked: false,
                                placeholder: false,
                            };
                            rows.set(definition, row);
                        }
                        const value = current[definition.id];
                        row.value = value == null ? "" : String(value);
                        row.checked = value === true;
                        row.placeholder =
                            row.value === "" && !definition.options?.some((option) => option.value === "");
                        return row;
                    });
                    return [
                        field.id,
                        { status: schema?.status ?? "loading", rows: projected, empty: definitions.length === 0 },
                    ];
                }),
            ),
        };
    };
}
