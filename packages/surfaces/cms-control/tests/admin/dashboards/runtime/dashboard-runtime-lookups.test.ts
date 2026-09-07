import { expect, test } from "bun:test";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { detailLookupUrls } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/lookups/urls";
import { sourceUrl } from "cms-control/components/admin/Resources/Dashboards/runtime/source";

const field: DashboardField = {
    id: "variant",
    label: "Variant",
    path: "variant",
    type: "combobox",
    lookup: {
        sourceId: "products",
        endpoint: "variants",
        params: { productId: "$field.productId", q: "$search", take: "$limit", skip: "$offset" },
        valuePath: "id",
        labelPath: "title",
    },
};

test("composes a declarative lookup for an explicit source", () => {
    const url = new URL(detailLookupUrls([field], "offers", { productId: "p1" }, {}).variant!);
    expect(url.pathname).toBe("/.cms/sources/products/variants");
});

test("leaves dependent lookup sources inactive until their field is available", () => {
    expect(detailLookupUrls([field], "offers", { productId: "" }, {})).toEqual({ variant: "" });
});

test("activates a dependent lookup with the initial bounded page", () => {
    const url = new URL(detailLookupUrls([field], "offers", { productId: "p1" }, {}).variant!);
    expect(Object.fromEntries(url.searchParams)).toEqual({ productId: "p1", take: "25", skip: "0" });
});

test("resolves bounded search and offset expressions for subsequent bound pages", () => {
    const url = sourceUrl("offers", field.lookup!, {
        fields: { productId: "p1" },
        search: "racket",
        limit: 25,
        offset: 25,
    });
    expect(Object.fromEntries(url.searchParams)).toEqual({ productId: "p1", q: "racket", take: "25", skip: "25" });
});
