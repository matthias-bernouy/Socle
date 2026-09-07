import { mountDetailFields } from "../dashboards/detail/boundDetail";
import { configureDetail, setSourceData, mountDetail } from "../dashboards/detail/boundDetail";
import { afterEach, describe, expect, test } from "bun:test";
import { P9rInput, Button, Combobox, P9rSelect, TokenInput } from "@bernouy/components";
import "../../../src/components/admin/Resources/Dashboards/widgets/w-detail/WDetail";
import { readFieldControlValue } from "../../../src/components/admin/Resources/Dashboards/widgets/w-detail/controls";
import {
    WIDGET_ACTION_EVENT,
    type WidgetActionDetail,
} from "../../../src/components/admin/Resources/Dashboards/widgets/shared";
import type { WDetailField } from "../../../src/components/admin/Resources/Dashboards/widgets/w-detail/types";

if (!customElements.get("p9r-input")) {
    customElements.define("p9r-input", P9rInput);
}
if (!customElements.get("p9r-button")) {
    customElements.define("p9r-button", Button);
}
if (!customElements.get("p9r-combobox")) {
    customElements.define("p9r-combobox", Combobox);
}
if (!customElements.get("p9r-select")) {
    customElements.define("p9r-select", P9rSelect);
}
if (!customElements.get("p9r-token-input")) {
    customElements.define("p9r-token-input", TokenInput);
}

const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch;
    document.body.replaceChildren();
});

describe("dashboard detail widget actions", () => {
    test("preserves the right row and serializes nested paths after deletion", async () => {
        const detail = document.createElement("cms-dashboard-w-detail");
        configureDetail(detail, {
            widget: "w-detail",
            id: "productDetail",
            source: { endpoint: "product" },
            title: { path: "title", fallback: "Product" },
            actions: [
                {
                    id: "saveProduct",
                    label: "Save product",
                    tone: "primary",
                    endpoint: { endpoint: "upsertProduct", body: { variantAxes: "$field.variantAxes" } },
                },
            ],
            main: [
                {
                    id: "variants",
                    title: "Variants",
                    fields: [
                        {
                            id: "variantAxes",
                            label: "Axes",
                            path: "variantAxes",
                            type: "table",
                            editable: true,
                            addLabel: "Add axis",
                            columns: [
                                { id: "label", label: "Label", path: "details.label", editable: true },
                                {
                                    id: "values",
                                    label: "Values",
                                    path: "details.values",
                                    editable: true,
                                    type: "tokens",
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        setSourceData(detail, {
            id: 2,
            title: "Product",
            variantAxes: [
                { id: "grip", details: { label: "Grip size", values: ["L1", "L2"] }, audit: { owner: "first" } },
                { id: "weight", details: { label: "Weight", values: ["250"] }, audit: { owner: "second" } },
            ],
        });

        const actions: WidgetActionDetail[] = [];
        detail.addEventListener(WIDGET_ACTION_EVENT, (event) => {
            actions.push((event as CustomEvent<WidgetActionDetail>).detail);
        });

        await mountDetail(detail);
        await Promise.resolve();

        detail.querySelector<HTMLButtonElement>("[data-table-remove]")!.click();
        const labelInput = detail.querySelector("p9r-input") as HTMLElement & { value: string };
        const valuesInput = detail.querySelector("p9r-token-input") as HTMLElement & { value: string };
        labelInput.value = "Weight updated";
        valuesInput.value = "285, 300";
        expect(detail.querySelector("[data-table-add]")?.textContent).toBe("Add axis");

        const save = detail.querySelector("p9r-button") as HTMLElement & { shadowRoot: ShadowRoot };
        save.shadowRoot.querySelector("button")!.click();

        expect(actions[0]?.fields).toEqual({
            variantAxes: [
                {
                    id: "weight",
                    details: { label: "Weight updated", values: ["285", "300"] },
                    audit: { owner: "second" },
                },
            ],
        });
    });

    test("returns deep snapshots for readonly table values", async () => {
        const source = [{ id: "axis", details: { label: "Size" } }];
        const field: WDetailField = {
            id: "axes",
            label: "Axes",
            input: "table",
            value: source,
            columns: [{ key: "label", label: "Label", path: "details.label" }],
        };
        const detail = await mountDetailFields(
            [
                {
                    id: "axes",
                    label: "Axes",
                    path: "axes",
                    type: "table",
                    columns: [{ id: "label", label: "Label", path: "details.label" }],
                },
            ],
            { axes: source },
        );
        const value = readFieldControlValue(field, detail.querySelector("[data-field-control=axes]")!) as Array<
            Record<string, unknown>
        >;

        (value[0]!.details as Record<string, unknown>).label = "Changed";

        expect(source).toEqual([{ id: "axis", details: { label: "Size" } }]);
    });
});
