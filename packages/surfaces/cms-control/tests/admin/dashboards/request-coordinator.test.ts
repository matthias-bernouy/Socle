import { describe, expect, test } from "bun:test";
import { DetailResourceState } from "cms-control/components/admin/Resources/Dashboards/domain";

describe("dashboard detail resource state", () => {
    test("retains only an exact dashboard detail resource", () => {
        const resources = new DetailResourceState();
        const resource = { id: "product-1", title: "Updated product" };
        resources.set("products", "catalog", "productDetail", "product-1", resource);

        expect(resources.current("products", "catalog", { collection: "productDetail", row: "product-1" })).toEqual({
            sourceId: "products",
            dashboardId: "catalog",
            collection: "productDetail",
            row: "product-1",
            resource,
        });
        expect(resources.current("products", "catalog", { collection: "productDetail", row: "product-2" })).toBeNull();
        expect(resources.current("products", "catalog", { collection: "productDetail", row: "product-1" })).toBeNull();
    });

    test("invalidates a pending result when navigation clears its scope", () => {
        const resources = new DetailResourceState();
        const finish = resources.beginAction();

        resources.clear();

        expect(finish()).toBe("stale");
    });

    test("keeps every overlapping action on its historical reload path", () => {
        const resources = new DetailResourceState();
        const finishFirst = resources.beginAction();
        const finishSecond = resources.beginAction();

        expect(finishFirst()).toBe("reload");
        expect(finishSecond()).toBe("reload");
    });

    test("clears a rendered resource without invalidating active actions", () => {
        const resources = new DetailResourceState();
        resources.set("products", "catalog", "productDetail", "product-1", { id: "product-1" });
        const finish = resources.beginAction();

        resources.clearResource();

        expect(resources.current("products", "catalog", { collection: "productDetail", row: "product-1" })).toBeNull();
        expect(finish()).toBe("reuse");
    });

    test("retains the rendered resource until an action outcome replaces or reloads it", () => {
        const resources = new DetailResourceState();
        const resource = { id: "product-1", title: "Current title" };
        const detail = { collection: "productDetail", row: "product-1" };
        resources.set("products", "catalog", detail.collection, detail.row, resource);

        const finish = resources.beginAction();

        expect(resources.current("products", "catalog", detail)?.resource).toBe(resource);
        expect(finish()).toBe("reuse");
    });
});
