import { expect, test } from "bun:test";
import { setSourceData } from "@bernouy/components";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { mountDashboardWidgets } from "cms-control/components/admin/Resources/Dashboards/runtime/mounting/mount";
import {
    formatDashboardDate,
    formatDashboardMoney,
} from "cms-control/components/admin/Resources/Dashboards/domain/formatting";
import { productDashboard, renderContext, simpleDetailWidget, waitFor } from "./fixtures";
import { setupDashboardWidgetSelectionTests } from "./setup";

setupDashboardWidgetSelectionTests();

function mount(fields: DashboardField[], resource: unknown): HTMLElement {
    const dashboard = productDashboard();
    const widget = { ...simpleDetailWidget(), main: [{ id: "general", title: "General", fields }] };
    const selection = { collection: widget.id, row: "product-1" };
    const core = document.createElement("cms-binding-core");
    mountDashboardWidgets(core, [widget] as never[], renderContext(dashboard, selection), "root", new Map(), selection);
    setSourceData(core.querySelector("cms-dashboard-w-detail")!, resource);
    document.body.append(core);
    return core.querySelector("cms-dashboard-w-detail")!;
}

test("readonly values use light-DOM conditions and repetitions across scalar, empty and list responses", async () => {
    const detail = mount([{ id: "value", label: "Value", path: "value", type: "readonly" }], {
        value: [" One ", "", null, false, 0, "Two"],
    });
    await waitFor(() => detail.querySelectorAll("li").length === 4);
    const field = detail.querySelector("cms-dashboard-detail-field")!;
    expect(detail.hasAttribute("cms-source")).toBe(true);
    expect(detail.querySelector("[cms-bind-value]")).toBeNull();
    expect(Array.from(field.querySelectorAll("li"), (item) => item.textContent)).toEqual(["One", "false", "0", "Two"]);
    expect(field.getRootNode()).toBe(document);
    setSourceData(detail, { value: [" ", null] });
    expect(field.querySelector("ul")).toBeNull();
    expect(field.querySelector("[data-display-empty]")?.textContent).toBe("None");
    for (const value of [false, 0, "Plain text", null]) {
        setSourceData(detail, { value });
        expect(field.querySelector("ul")).toBeNull();
        expect(field.querySelector("[data-display-empty]")).toBeNull();
        expect(field.querySelector("[data-display-text]")?.textContent).toBe(value === null ? "" : String(value));
    }
});

test("readonly dates, money, badges and images keep the previous formatting and empty states", async () => {
    const fields: DashboardField[] = [
        { id: "date", label: "Date", path: "date", type: "readonly", format: "date" },
        { id: "money", label: "Money", path: "price.amount", type: "readonly", format: "money" },
        { id: "badge", label: "Badge", path: "tags", type: "readonly", format: "badge" },
        { id: "image", label: "Image", path: "image", type: "readonly", format: "image" },
    ];
    const resource = {
        date: "2026-09-07",
        price: { amount: 1234 },
        currency: "EUR",
        tags: [" A ", "", "B"],
        image: "",
    };
    const detail = mount(fields, resource);
    await waitFor(() => detail.querySelectorAll("cms-dashboard-detail-field").length === 4);
    const [date, money, badge, image] = Array.from(detail.querySelectorAll("cms-dashboard-detail-field"));
    expect(date!.textContent?.trim()).toBe(formatDashboardDate(resource.date));
    expect(money!.textContent?.trim()).toBe(formatDashboardMoney(1234, "EUR"));
    expect(badge!.textContent?.trim()).toBe("A,B");
    expect(image!.querySelector("img")).toBeNull();
    expect(image!.textContent?.trim()).toBe("No image");
    setSourceData(detail, { ...resource, price: { amount: 1234, currency: "JPY" }, image: "/example.png" });
    expect(money!.textContent?.trim()).toBe(formatDashboardMoney(1234, "JPY"));
    expect(image!.querySelector("img")?.getAttribute("data-cms-src")).toBe("/example.png");
    // Chromium coverage also verifies activation and the completed image request.
    expect(image!.querySelector("img")?.alt).toBe("Image");
    expect(image!.querySelector("span")).toBeNull();
});

test("detail titles show their fallback for missing values while retaining zero and false", async () => {
    const detail = mount([], {});
    await waitFor(() => detail.querySelector("[slot=bound-title]")?.textContent === "Product");
    for (const title of ["Updated", 0, false, null, ""]) {
        setSourceData(detail, { title });
        expect(detail.querySelector("[slot=bound-title]")?.textContent).toBe(
            title === null || title === "" ? "Product" : String(title),
        );
    }
});
