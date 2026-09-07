import { afterEach, expect, test } from "bun:test";
import { mountDetailFields } from "../../dashboards/detail/boundDetail";

afterEach(() => document.body.replaceChildren());

test("submits declared row identities alongside editors without copying hidden row objects", async () => {
    const detail = await mountDetailFields(
        [
            {
                id: "axes",
                path: "axes",
                label: "Axes",
                type: "table",
                editable: true,
                rowKey: "key",
                columns: [
                    { id: "field", path: "fieldKey", label: "Metadata", editable: true },
                    { id: "values", path: "values", label: "Values", editable: true, type: "tokens" },
                ],
            },
        ],
        {
            axes: [
                {
                    key: "legacy-size",
                    label: "Size",
                    fieldKey: "",
                    values: ["S", "M"],
                    privateData: { retainedByEndpoint: true },
                },
                { fieldKey: "color", values: ["Red"] },
            ],
        },
    );
    const control = detail.querySelector<HTMLElement & { value: unknown }>("cms-dashboard-table-field")!;
    expect(control.value).toEqual([
        { key: "legacy-size", fieldKey: "", values: ["S", "M"] },
        { fieldKey: "color", values: ["Red"] },
    ]);
    const identities = Array.from(control.querySelectorAll<HTMLInputElement>("[data-table-row-key]"));
    expect(identities.map((input) => input.value)).toEqual(["legacy-size", ""]);
    expect(identities.every((input) => input.type === "hidden" && !input.hasAttribute("name"))).toBe(true);
});
