import { readSourceData } from "@bernouy/components";
import type { DetailSchema, DetailSchemas } from "../../../../../runtime/mapping/types";
import { definitionsAt } from "../../../runtime/schemas/definitions";
import type { DashboardSchemaSource } from "./Source";

const cache = new WeakMap<Element, { payload: unknown; definitions: DetailSchema["definitions"] }>();

/** Shared source cache projection for form validation and document binding. */
export function boundSchemas(host: HTMLElement): DetailSchemas {
    return Object.fromEntries(
        Array.from(host.querySelectorAll<DashboardSchemaSource>("cms-dashboard-schema-source")).map((source) => {
            const payload = readSourceData(source);
            let entry = cache.get(source);
            if (!entry || !Object.is(entry.payload, payload)) {
                entry = {
                    payload,
                    definitions: definitionsAt(payload, source.getAttribute("items-path") ?? undefined),
                };
                cache.set(source, entry);
            }
            return [source.getAttribute("field-id")!, { definitions: entry.definitions, status: source.status }];
        }),
    );
}
