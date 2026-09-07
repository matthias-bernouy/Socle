import { afterEach, expect, test } from "bun:test";
import { configureDetail, mountDetail, setSourceData } from "../../dashboards/detail/boundDetail";
import { DashboardWDetail } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/WDetail";
import { waitForDetail } from "../../dashboards/detail/detailTestHelpers";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
    document.body.replaceChildren();
});

test("a source seeded before connection renders declarations in document light DOM", async () => {
    const detail = createDetail();
    setSourceData(detail, { title: "Seeded product", name: "Original" });
    await mountDetail(detail);
    expect(detail.textContent).toContain("Seeded product");
    expect(detail.querySelector("[data-field-control=name]")?.getRootNode()).toBe(document);
    expect(detail.shadowRoot?.querySelector("[data-field-control]")).toBeNull();
    expect("data" in detail).toBe(false);
});

test("a new row resets drafts while a response refresh preserves unacknowledged edits", async () => {
    const detail = createDetail();
    detail.dataset.rowKey = "first";
    setSourceData(detail, { title: "First", name: "Original" });
    await mountDetail(detail);
    detail.applyFieldDraft("name", "Local edit");
    setSourceData(detail, { title: "First refreshed", name: "Server value" });
    expect(detail.currentFieldValues()).toEqual({ name: "Local edit" });
    detail.dataset.rowKey = "second";
    setSourceData(detail, { title: "Second", name: "Second name" });
    expect(detail.currentFieldValues()).toEqual({ name: "Second name" });
});

test("reconnecting the page source reloads data and discards the detached draft", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
        calls += 1;
        return Response.json({ title: `Version ${calls}`, name: `Name ${calls}` });
    }) as unknown as typeof fetch;
    const detail = createDetail();
    detail.setAttribute("cms-source", "/item");
    await mountDetail(detail);
    await waitForDetail(() => detail.textContent?.includes("Version 1") === true);
    detail.applyFieldDraft("name", "Detached edit");
    const core = detail.parentElement!;
    core.remove();
    document.body.append(core);
    await waitForDetail(() => detail.textContent?.includes("Version 2") === true);
    expect(detail.currentFieldValues()).toEqual({ name: "Name 2" });
    expect(calls).toBe(2);
});

function createDetail(): DashboardWDetail {
    const detail = new DashboardWDetail();
    configureDetail(detail, {
        widget: "w-detail",
        id: "detail",
        source: { endpoint: "item" },
        title: { path: "title" },
        main: [{ id: "main", title: "Main", fields: [{ id: "name", label: "Name", path: "name", type: "text" }] }],
    });
    return detail;
}
