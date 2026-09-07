import { afterEach, expect, test } from "bun:test";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { detailLookupUrls } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/lookups/urls";

const scope = document.documentElement.dataset.dashboardScope;
afterEach(() => {
    if (scope === undefined) {
        delete document.documentElement.dataset.dashboardScope;
    } else {
        document.documentElement.dataset.dashboardScope = scope;
    }
});
function field(params: Record<string, string>): DashboardField {
    return {
        id: "brand",
        label: "Brand",
        path: "brand",
        type: "combobox",
        lookup: { endpoint: "brands", sourceId: "catalogue", valuePath: "id", labelPath: "name", params },
    };
}

test("literal empty parameters do not block lookups, and unresolved dependencies do", () => {
    const fields = [field({ category: "$field.category", optional: "", q: "$search", offset: "$offset" })];
    expect(detailLookupUrls(fields, "store", {}, {}).brand).toBe("");
    const url = new URL(detailLookupUrls(fields, "store", { category: "tennis" }, {}).brand!);
    expect(url.pathname).toEndWith("/.cms/sources/catalogue/brands");
    expect(url.searchParams.has("optional")).toBe(false);
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.has("offset")).toBe(false);
});

test("paginated lookup requests use the active operator scope and explicit cross-source endpoint", () => {
    document.documentElement.dataset.dashboardScope = "operator dashboard";
    const url = new URL(detailLookupUrls([field({ limit: "$limit", offset: "$offset" })], "store", {}, {}).brand!);
    expect(url.pathname).toEndWith("/.cms/dashboards/operator%20dashboard/sources/catalogue/brands");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("offset")).toBe("0");
});
