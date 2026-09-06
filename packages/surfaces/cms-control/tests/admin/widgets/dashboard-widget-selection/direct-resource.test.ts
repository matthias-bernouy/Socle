import { describe, expect, test } from "bun:test";
import { mountDashboardWidgets } from "cms-control/components/admin/Resources/Dashboards/runtime/mounting/mount";
import {
    detailResource,
    productDashboard,
    productDetailWidget,
    renderContext,
    simpleDetailWidget,
    waitFor,
} from "./fixtures";
import { setupDashboardWidgetSelectionTests } from "./setup";

setupDashboardWidgetSelectionTests();

describe("dashboard widget selection", () => {
    test("mounts a matching action resource without refetching the main detail", async () => {
        const resource = {
            id: "product-1",
            title: "Updated product",
            categoryId: "category-1",
            brandId: "brand-1",
            attributes: { material: null },
        };
        const requests: string[] = [];
        globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
            const url = new URL(String(input), window.location.origin);
            requests.push(`${url.pathname}${url.search}`);
            if (url.pathname.endsWith("/getProduct")) {
                return Response.json({ item: resource });
            }
            if (url.pathname.endsWith("/brands")) {
                return Response.json({ items: [{ id: "brand-1", name: "Acme" }] });
            }
            if (url.pathname.endsWith("/categorySchema")) {
                return Response.json({ fields: [{ id: "material", label: "Material", type: "string" }] });
            }
            if (url.pathname === "/api/relations/page") {
                return Response.json({ items: [] });
            }
            return new Response("unexpected source", { status: 500 });
        }) as unknown as typeof fetch;
        const dashboard = productDashboard();
        const widget = productDetailWidget();
        const selection = { collection: "productDetail", row: "product-1" };
        const root = document.createElement("cms-binding-core");
        mountDashboardWidgets(
            root,
            [widget] as never[],
            renderContext(dashboard, detailResource(dashboard, selection, resource)),
            "root",
            new Map(),
            selection,
        );
        document.body.append(root);

        await waitFor(
            () =>
                requests.some((url) => url.includes("/brands")) &&
                requests.some((url) => url.includes("/categorySchema")) &&
                requests.some((url) => url.startsWith("/api/relations/page")),
        );

        const detail = root.querySelector<HTMLElement>("cms-dashboard-w-detail")!;
        expect(detail.hasAttribute("data-config-json")).toBe(false);
        expect(root.querySelector("[cms-source*='/getProduct']")).toBeNull();
        expect(detail.hasAttribute("data-source-json")).toBe(false);
        expect(detail.shadowRoot!.querySelector('[data-field-control="title"]')).not.toBeNull();
        expect(requests.some((url) => url.includes("/getProduct"))).toBeFalse();
        expect(requests.filter((url) => url.includes("/brands"))).toHaveLength(1);
        expect(requests.filter((url) => url.includes("/categorySchema"))).toHaveLength(1);
        expect(requests.filter((url) => url.startsWith("/api/relations/page"))).toHaveLength(1);
    });

    test("restores the bound source on the same detail host after clearing an action resource", async () => {
        let requests = 0;
        globalThis.fetch = (async () => {
            requests += 1;
            return Response.json({ item: { id: "product-1", title: "Reloaded" } });
        }) as unknown as typeof fetch;
        const dashboard = productDashboard();
        const widget = simpleDetailWidget();
        const selection = { collection: "productDetail", row: "product-1" };
        const root = document.createElement("cms-binding-core");
        const tabs = new Map<string, number>();
        mountDashboardWidgets(
            root,
            [widget] as never[],
            renderContext(dashboard, detailResource(dashboard, selection, { id: "product-1", title: "Saved" })),
            "root",
            tabs,
            selection,
        );
        document.body.append(root);
        const detail = root.querySelector("cms-dashboard-w-detail");
        mountDashboardWidgets(
            root,
            [widget] as never[],
            renderContext(dashboard, detailResource(dashboard, selection, null)),
            "root",
            tabs,
            selection,
        );
        await waitFor(() => requests === 1);
        expect(root.querySelector("cms-dashboard-w-detail")).toBe(detail);
        expect(root.querySelector("[cms-source*='/getProduct']")).not.toBeNull();
    });

    test("keeps the source request when an action resource is null", async () => {
        let requests = 0;
        globalThis.fetch = (async () => {
            requests += 1;
            return Response.json(null);
        }) as unknown as typeof fetch;
        const dashboard = productDashboard();
        const widget = simpleDetailWidget();
        const selection = { collection: "productDetail", row: "product-1" };
        const root = document.createElement("cms-binding-core");
        mountDashboardWidgets(
            root,
            [widget] as never[],
            renderContext(dashboard, detailResource(dashboard, selection, null)),
            "root",
            new Map(),
            selection,
        );
        document.body.append(root);

        await waitFor(() => requests === 1);

        expect(root.querySelector("[cms-source*='/getProduct']")).not.toBeNull();
        expect(requests).toBe(1);
    });

    test("keeps the source wrapper when the action resource does not match", () => {
        const dashboard = productDashboard();
        const widget = simpleDetailWidget();
        const selection = { collection: "productDetail", row: "product-1" };
        const mismatch = {
            ...detailResource(dashboard, selection, { id: "private-product" }),
            sourceId: "another-source",
            row: "product-2",
        };
        const root = document.createElement("cms-binding-core");
        mountDashboardWidgets(
            root,
            [widget] as never[],
            renderContext(dashboard, mismatch),
            "root",
            new Map(),
            selection,
        );

        const wrapper = root.querySelector<HTMLElement>("[cms-source*='/getProduct']")!;
        const detail = wrapper.closest<HTMLElement>("cms-dashboard-w-detail")!;
        expect(wrapper.getAttribute("cms-source")).toBe(
            "/.cms/sources/products/getProduct?id=product-1 as dashboardData",
        );
        expect(detail.hasAttribute("data-source-json")).toBe(false);
        expect(wrapper.querySelector("[cms-bind-value=dashboardData]")).toBeNull();
        expect(wrapper.querySelector("[data-field-control]")).not.toBeNull();
    });
});
