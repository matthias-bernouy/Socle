import { configureDetail, setSourceData, mountDetail } from "../dashboards/detail/boundDetail";
import { afterEach, describe, expect, test } from "bun:test";
import { Combobox, P9rSelect } from "@bernouy/components";
import "../../../src/components/admin/Resources/Dashboards/widgets/w-detail/WDetail";
import { WIDGET_FIELD_CHANGE_EVENT } from "../../../src/components/admin/Resources/Dashboards/widgets/shared";

if (!customElements.get("p9r-combobox")) {
    customElements.define("p9r-combobox", Combobox);
}
if (!customElements.get("p9r-select")) {
    customElements.define("p9r-select", P9rSelect);
}

const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch;
    document.body.replaceChildren();
});

describe("dashboard detail reorderable list", () => {
    test("keeps the edited input focused while its value changes", async () => {
        const detail = document.createElement("cms-dashboard-w-detail");
        configureDetail(detail, {
            widget: "w-detail",
            id: "fieldDetail",
            source: { endpoint: "field" },
            main: [
                {
                    id: "options",
                    title: "Allowed values",
                    fields: [
                        {
                            id: "options",
                            label: "Allowed values",
                            path: "options",
                            type: "reorderable-list",
                            itemKey: "id",
                            positionPath: "order.position",
                            fields: [
                                { id: "value", label: "Value", path: "value", required: true },
                                { id: "label", label: "Label", path: "metadata.label", required: true },
                                { id: "required", label: "Required", path: "required", type: "checkbox" },
                            ],
                        },
                    ],
                },
            ],
        });
        setSourceData(detail, {
            options: [
                {
                    id: "agency",
                    value: "agency",
                    metadata: { label: "Agency" },
                    required: false,
                    order: { position: 0 },
                },
            ],
        });
        await mountDetail(detail);
        await Promise.resolve();

        const changes: Array<{ rowKey: string; field: string; value: unknown }> = [];
        detail.addEventListener(WIDGET_FIELD_CHANGE_EVENT, (event) => {
            changes.push((event as CustomEvent<{ rowKey: string; field: string; value: unknown }>).detail);
        });
        const list = detail.querySelector<HTMLElement>("cms-dashboard-reorderable-field")!;
        const initialSnapshot = (list as HTMLElement & { items: Array<Record<string, unknown>> }).items;
        const input = list.querySelector<HTMLInputElement>("[data-item-path='metadata.label']")!;
        input.focus();
        input.value = "Agency updated";
        input.dispatchEvent(new Event("input", { bubbles: true }));

        const renderedList = detail.querySelector<HTMLElement>("cms-dashboard-reorderable-field")!;
        expect(renderedList).toBe(list);
        expect(renderedList.querySelector("[data-item-path='metadata.label']")).toBe(input);
        expect(document.activeElement).toBe(input);
        expect(initialSnapshot[0]).toEqual({
            id: "agency",
            value: "agency",
            metadata: { label: "Agency" },
            required: false,
            order: { position: 0 },
        });
        expect(changes.at(-1)).toEqual({
            rowKey: "",
            field: "options",
            value: [
                {
                    id: "agency",
                    value: "agency",
                    metadata: { label: "Agency updated" },
                    required: false,
                    order: { position: 0 },
                },
            ],
        });

        const checkbox = list.querySelector<HTMLInputElement>("input[type='checkbox']")!;
        checkbox.click();
        expect(changes.at(-1)?.value).toEqual([
            {
                id: "agency",
                value: "agency",
                metadata: { label: "Agency updated" },
                required: true,
                order: { position: 0 },
            },
        ]);
    });
});
