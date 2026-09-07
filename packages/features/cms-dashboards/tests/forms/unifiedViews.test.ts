import { expect, test } from "bun:test";
import { validateDashboard, type DashboardDto, type DashboardField } from "@bernouy/cms-dashboards";

function fixture() {
    const target = {
        widget: "w-detail" as const,
        id: "item",
        source: { endpoint: "get" },
        create: {},
        save: { endpoint: "upsert" },
        main: [{ id: "main", title: "Main", fields: [] as DashboardField[] }],
    };
    const table = {
        widget: "w-table" as const,
        id: "items",
        source: { endpoint: "list" },
        rowKey: "id",
        columns: [{ id: "name", path: "name", label: "Name" }],
        create: { viewId: "item", presentation: "page" as const },
    };
    const dashboard: DashboardDto = { id: "catalog", source: "catalog", views: [table, target] };
    return { dashboard, target, table };
}

test("local creation resolves a detail with one common save and an explicit creation capability", () => {
    const { dashboard, target, table } = fixture();
    expect(validateDashboard(dashboard)).toEqual([]);
    table.create.viewId = "items";
    expect(validateDashboard(dashboard)).toContain('views.0.create.viewId references unknown detail view "items"');
    table.create.viewId = "item";
    Reflect.deleteProperty(target, "create");
    expect(validateDashboard(dashboard)).toContain(
        "views.0.create.viewId must reference a detail with save and create",
    );
});

test("lookup editing reuses an existing detail without requiring creation; cross-dashboard refs stay explicit", () => {
    const { dashboard, target } = fixture();
    const lookup = {
        endpoint: "lookup",
        valuePath: "id",
        labelPath: "name",
        edit: { viewId: "item", presentation: "modal" as const, valuePath: "id", labelPath: "name" },
    };
    target.main[0]!.fields = [{ id: "related", label: "Related", path: "relatedId", type: "combobox", lookup }];
    expect(validateDashboard(dashboard)).toEqual([]);
    Object.assign(lookup.edit, { dashboardId: "taxonomy", viewId: "brand" });
    expect(validateDashboard(dashboard)).toEqual([]);
    Object.assign(lookup.edit, { presentation: "page" });
    expect(validateDashboard(dashboard)).toContain(
        "views.1.main.0.fields.0.lookup.edit.presentation must be modal for lookup details",
    );
    Object.assign(lookup, { edit: null });
    expect(validateDashboard(dashboard)).toContain("views.1.main.0.fields.0.lookup.edit must be an object");
});

test("staged uploads declare a scalar session contribution without colliding with editable controls", () => {
    const { dashboard, target } = fixture();
    const media: Extract<DashboardField, { type: "media" }> = {
        id: "images",
        label: "Images",
        path: "images",
        name: "mediaIds",
        type: "media",
        persist: "save",
        item: { idPath: "id", urlPath: "url" },
        actions: { upload: { endpoint: "stage" } },
    };
    target.main[0]!.fields = [media];
    expect(validateDashboard(dashboard)).toContain("views.1.main.0.fields.0.staging is required for staged uploads");
    media.staging = { sessionField: "uploadSessionId" };
    expect(validateDashboard(dashboard)).toEqual([]);
    media.staging.sessionField = "mediaIds";
    expect(validateDashboard(dashboard).some((error) => error.includes("conflicts with another form control"))).toBe(
        true,
    );
    media.staging.sessionField = "__proto__[polluted]";
    expect(validateDashboard(dashboard)).toContain(
        "views.1.main.0.fields.0.staging.sessionField must be a safe form name",
    );
    delete media.persist;
    expect(validateDashboard(dashboard)).toContain(
        "views.1.main.0.fields.0.staging requires persist save and an upload action",
    );
});
