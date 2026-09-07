import type { DashboardWidget } from "@bernouy/cms-dashboards";
import { composeDetail } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/binding/composition";
import { expect, test } from "bun:test";
import { setSourceData } from "@bernouy/components";
import { DashboardWDetail } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/WDetail";
import { setupDashboardWidgetSelectionTests } from "./setup";
import { waitFor } from "./fixtures";

setupDashboardWidgetSelectionTests();

test("bound choice controls preserve their options and emit typed edited values for saving", async () => {
    const core = document.createElement("cms-binding-core");
    const detail = new DashboardWDetail();
    const widget: Extract<DashboardWidget, { widget: "w-detail" }> = {
        widget: "w-detail",
        id: "choices",
        source: { endpoint: "item" },
        actions: [{ id: "save", label: "Save", endpoint: { endpoint: "save" } }],
        main: [
            {
                id: "general",
                title: "General",
                fields: [
                    {
                        id: "brand",
                        label: "Brand",
                        path: "brand",
                        type: "combobox",
                        options: [
                            { label: "First", value: "first" },
                            { label: "Duplicate", value: "first" },
                            { label: "Second", value: "second" },
                        ],
                    },
                    {
                        id: "tags",
                        label: "Tags",
                        path: "tags",
                        type: "tokens",
                        allowCustom: true,
                        required: true,
                        options: [
                            { label: "One", value: "one" },
                            { label: "Two", value: "two" },
                        ],
                    },
                ],
            },
        ],
    };
    detail.configure(widget);
    detail.append(composeDetail(widget));
    detail.setAttribute("cms-source", "/item as dashboardData");
    setSourceData(detail, { brand: "first", tags: ["one"] });
    core.append(detail);
    document.body.append(core);
    await waitFor(() => detail.querySelectorAll("[data-field-control]").length === 2);
    const brand = detail.querySelector<HTMLElement & { value: string }>("p9r-combobox")!;
    const tags = detail.querySelector<HTMLElement & { value: string; values: string[] }>("p9r-token-input")!;
    expect(brand.value).toBe("first");
    expect(tags.values).toEqual(["one"]);
    expect(Array.from(brand.querySelectorAll("option"), (option) => option.textContent)).toEqual(["First", "Second"]);
    expect(tags.hasAttribute("creatable")).toBe(true);
    expect(brand.hasAttribute("creatable")).toBe(false);
    expect(tags.getRootNode()).toBe(document);
    const actions: Array<{ fields: Record<string, unknown> }> = [];
    detail.addEventListener("cms-dashboard-widget:action", (event) => actions.push((event as CustomEvent).detail));
    brand.value = "second";
    brand.dispatchEvent(new Event("change", { bubbles: true }));
    tags.value = "two,custom";
    tags.dispatchEvent(new Event("change", { bubbles: true }));
    setSourceData(detail, { brand: "first", tags: ["one"], refreshed: true });
    expect(brand.value).toBe("second");
    expect(tags.values).toEqual(["two", "custom"]);
    detail.querySelector<HTMLElement>("[data-action=save]")!.click();
    expect(actions).toHaveLength(1);
    expect(actions[0]!.fields).toEqual({ brand: "second", tags: ["two", "custom"] });
    tags.value = "";
    tags.dispatchEvent(new Event("change", { bubbles: true }));
    detail.querySelector<HTMLElement>("[data-action=save]")!.click();
    expect(actions).toHaveLength(1);
    expect(tags.getAttribute("aria-invalid")).toBe("true");
});
