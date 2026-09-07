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
    test("loads lookup options for an item combobox without enabling creation", async () => {
        const requests: Request[] = [];
        globalThis.fetch = (async (input, init) => {
            const request = new Request(
                input instanceof Request ? input : new URL(String(input), window.location.href),
                init,
            );
            requests.push(request);
            return Response.json({
                items: [
                    { key: "grip", label: "Grip", fieldType: "enum" },
                    { key: "weight", label: "Weight", fieldType: "number" },
                ],
            });
        }) as typeof fetch;

        const detail = document.createElement("cms-dashboard-w-detail");
        configureDetail(detail, {
            widget: "w-detail",
            id: "categoryDetail",
            source: { endpoint: "category" },
            main: [
                {
                    id: "metadata",
                    title: "Product metadata",
                    fields: [
                        {
                            id: "categoryFields",
                            label: "Product metadata",
                            path: "categoryFields",
                            type: "reorderable-list",
                            itemKey: "fieldKey",
                            fields: [
                                {
                                    id: "fieldKey",
                                    label: "Product metadata",
                                    path: "fieldKey",
                                    type: "combobox",
                                    lookup: {
                                        endpoint: "entityCustomFields",
                                        params: { entityType: "product" },
                                        itemsPath: "items",
                                        valuePath: "key",
                                        labelPath: "label",
                                    },
                                },
                                {
                                    id: "operator",
                                    label: "Operator",
                                    path: "operator",
                                    type: "select",
                                    options: [
                                        { value: "eq", label: "Equals" },
                                        { value: "in", label: "Contains" },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        setSourceData(detail, {
            id: 2,
            categoryFields: [{ fieldKey: "grip", operator: "eq" }],
        });
        detail.setAttribute("data-source-id", "commerce");
        const changes: Array<{ value: unknown }> = [];
        detail.addEventListener(WIDGET_FIELD_CHANGE_EVENT, (event) => {
            changes.push((event as CustomEvent<{ value: unknown }>).detail);
        });

        await mountDetail(detail);
        await waitFor(() =>
            Boolean(
                detail
                    .querySelector<HTMLElement>("cms-dashboard-reorderable-field")
                    ?.querySelector("p9r-combobox option[value='weight']"),
            ),
        );

        const list = detail.querySelector("cms-dashboard-reorderable-field")!;
        const combobox = list.querySelector<HTMLElement & { value: string }>("p9r-combobox")!;
        const select = list.querySelector<HTMLElement & { value: string }>("p9r-select")!;
        expect(requests[0]?.url).toContain("/.cms/sources/commerce/entityCustomFields?entityType=product");
        expect(combobox.hasAttribute("creatable")).toBeFalse();
        expect(combobox.querySelector("option[value='grip']")?.textContent).toBe("Grip");
        expect(select.querySelector("option[value='eq']")?.textContent).toBe("Equals");

        combobox.value = "weight";
        combobox.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        expect(changes.at(-1)?.value).toEqual([{ fieldKey: "weight", operator: "eq", position: 0 }]);
    });
});

async function waitFor(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("condition was not met");
}
