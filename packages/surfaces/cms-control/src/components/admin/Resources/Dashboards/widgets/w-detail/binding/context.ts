import { mediaUploadSessions } from "../../../runtime/actions/forms/views/media";
import { sourceUrl } from "../../../runtime/source";
import { directoryContext } from "../lookups/directoryContext";
import { schemaContext } from "../controls/schema/binding/context";
import { tableContext, tableLookupContexts } from "../controls/table/context";
import { reorderableContext } from "../../w-reorderable-list/binding/context";
import { mediaContext } from "../../w-media-field/binding/context";
import { detailLookupUrls, tableLookupUrls, choiceLookupUrls } from "../lookups/urls";
import { readSourceData, setSourceContext } from "@bernouy/components";
import { fieldValues } from "../../../runtime/mapping";
import { matchesDashboardVisibility, setValueAt, valueAt } from "../../../runtime/expressions";
import { moneyFieldContext } from "../../../runtime/mapping/money";
import { actionLayout } from "./actions";
import type { DetailWidget } from "../runtime/fieldState";

/** Project response values and local edits into binding scope; never constructs DOM. */
export function bindDetailContext(
    host: HTMLElement,
    widget: DetailWidget,
    draft: (resource: unknown) => Record<string, unknown>,
): void {
    const fields = [...widget.main, ...(widget.aside ?? [])].flatMap((section) =>
        "widget" in section ? [] : section.fields,
    );
    const users = directoryContext(host, fields);
    const media = mediaContext(host, fields);
    const schemas = schemaContext(host, fields);
    const tables = tableContext(host, fields);
    const choices = reorderableContext(host, fields);
    const actions = actionLayout((widget.actions ?? []).filter((action) => !action.form));
    const rules = Object.fromEntries(fields.map((field) => [field.id, field.visibleWhen]));
    setSourceContext(host, () => {
        const source = readSourceData(host);
        const resource = widget.source.itemPath ? valueAt(source, widget.source.itemPath) : source;
        const edits = draft(resource);
        const values = { ...fieldValues(widget, resource), ...edits };
        let effective = structuredClone(resource);
        for (const field of fields) {
            if (!Object.hasOwn(edits, field.id)) {
                continue;
            }
            if (field.path === ".") {
                effective = edits[field.id];
            } else if (effective && typeof effective === "object" && !Array.isArray(effective)) {
                setValueAt(effective as Record<string, unknown>, field.path, edits[field.id]);
            }
        }
        const nested = choices(values, edits);
        const sessions = mediaUploadSessions(host);
        return {
            detailChoices: nested.result,
            detailChoiceLookupUrls: choiceLookupUrls(fields, host.dataset.sourceId ?? "", values, resource),
            detailTables: tables(values),
            ...tableLookupContexts(host),
            detailTableLookupUrls: tableLookupUrls(fields, host.dataset.sourceId ?? "", values, resource),
            ...schemas(values, resource),
            detailMedia: media(values, edits, nested.urls),
            detailUploadSessions: sessions,
            detailMediaUploadUrls: Object.fromEntries(
                fields
                    .filter((field) => field.type === "media" && field.persist === "save")
                    .map((field) => {
                        const ref = field.type === "media" ? field.actions?.upload : undefined;
                        if (!ref) {
                            return [field.id, ""];
                        }
                        const url = sourceUrl(host.dataset.sourceId ?? "", ref, { resource });
                        if (sessions[field.id]) {
                            url.searchParams.set("sessionId", sessions[field.id]!);
                        }
                        return [field.id, url.href];
                    }),
            ),
            ...users(values, resource),
            detailResourcePath: widget.source.itemPath ?? "",
            detailLookupUrls: detailLookupUrls(fields, host.dataset.sourceId ?? "", values, resource),
            detailReady: resource !== null && resource !== undefined,
            detailPersisted: !widget.create || host.dataset.rowKey !== "__new__",
            detailValues: effective,
            detailResource: resource,
            detailOperations: Object.fromEntries(
                (widget.actions ?? [])
                    .filter((action) => action.form)
                    .map((action) => {
                        const operationFields = action.form!.fields ?? [];
                        const operationValues = Object.fromEntries(
                            operationFields.map((field) => [field.id, valueAt(resource, field.path)]),
                        );
                        return [
                            action.id,
                            { resource, resourceMoney: moneyFieldContext(operationFields, resource, operationValues) },
                        ];
                    }),
            ),
            detailSelection: { id: host.dataset.rowKey ?? "" },
            detailRow: resource,
            detailOperationVisibility: Object.fromEntries(
                (widget.actions ?? []).map((action) => [
                    action.id,
                    resource != null && matchesDashboardVisibility(action.visibleWhen, { fields: values, resource }),
                ]),
            ),
            detailActions: actions(values, resource),
            detailValuesMoney: moneyFieldContext(fields, resource, values),
            detailVisibility: { fields: values, resource },
            detailRules: rules,
        };
    });
}
