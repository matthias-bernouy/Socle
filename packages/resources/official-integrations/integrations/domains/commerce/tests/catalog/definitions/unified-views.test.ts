import { expect, test } from "bun:test";
import { commerceDefinitionWithDeferredDashboards } from "../support/deferredDashboards";

async function views() {
    const definition = await commerceDefinitionWithDeferredDashboards<any>();
    const dashboards = definition.artifacts.flatMap((artifact: any) => (artifact.view ? [artifact.view] : []));
    const product = dashboards.find((dashboard: any) => dashboard.id === "commerce-products");
    const taxonomy = dashboards.find((dashboard: any) => dashboard.id === "commerce-taxonomy");
    return { product, taxonomy };
}

test("product creation references the same full detail used by existing rows", async () => {
    const { product } = await views();
    const table = product.views.find((view: any) => view.id === "productsTable");
    const detail = product.views.find((view: any) => view.id === table.create.viewId);
    expect(table.create).toMatchObject({ viewId: "productDetail", presentation: "page" });
    expect(table.create).not.toHaveProperty("fields");
    expect(table.create).not.toHaveProperty("endpoint");
    expect(table.selection.opens).toBe(detail.id);
    expect(detail.create).toBeDefined();
    expect(detail.save.endpoint).toBe("upsertProduct");
    expect(detail.save.hiddenFields).toEqual([
        { name: "id", value: "$resource.id", type: "number", empty: "omit" },
        { name: "expectedVersion", value: "$resource.version", type: "number", empty: "omit" },
        { name: "creationToken", value: "$resource.creationToken", type: "string", empty: "omit" },
    ]);
    const fields = detail.main.flatMap((section: any) => section.fields);
    expect(fields.find((field: any) => field.id === "slug").required).not.toBe(true);
    expect(fields.map((field: any) => field.id)).toEqual(
        expect.arrayContaining(["media", "variantAxes", "variantMatrix", "metadata"]),
    );
});

test("brand lookup creates and edits through the full taxonomy detail without duplicated fields", async () => {
    const { product, taxonomy } = await views();
    const detail = product.views.find((view: any) => view.id === "productDetail");
    const lookup = detail.aside
        .flatMap((section: any) => section.fields)
        .find((field: any) => field.id === "brandId").lookup;
    for (const operation of [lookup.create, lookup.edit]) {
        expect(operation).toMatchObject({
            dashboardId: taxonomy.id,
            viewId: "brandDetail",
            presentation: "modal",
            valuePath: "id",
            labelPath: "name",
        });
        expect(operation).not.toHaveProperty("fields");
        expect(operation).not.toHaveProperty("endpoint");
    }
    const brand = taxonomy.views.find((view: any) => view.id === lookup.create.viewId);
    expect(brand.create).toBeDefined();
    expect(brand.save.endpoint).toBe("upsertBrand");
    expect(brand.main[0].fields.map((field: any) => field.id)).toContain("description");
    expect(brand.aside[0].fields.map((field: any) => field.id)).toContain("status");
});

test("taxonomy collection creation and deletion use their corresponding detail forms", async () => {
    const { taxonomy } = await views();
    for (const id of ["brandsTable", "categoriesTable"]) {
        const list = taxonomy.views.find((view: any) => view.id === id);
        const detail = taxonomy.views.find((view: any) => view.id === list.create.viewId);
        expect(list.create.presentation).toBe("page");
        expect(list.create.viewId).toBe(list.selection.opens);
        expect(detail.create).toBeDefined();
        expect(detail.save).not.toHaveProperty("body");
        expect(detail.delete.confirm).toBeTruthy();
        expect(list.actions.every((action: any) => !action.selection)).toBe(true);
        expect(list.actions.find((action: any) => action.id === list.reorderable.action)).toBeDefined();
    }
});

test("product uploads stage in a form session without requiring a persisted product id", async () => {
    const { product } = await views();
    const detail = product.views.find((view: any) => view.id === "productDetail");
    const media = detail.main.flatMap((section: any) => section.fields).find((field: any) => field.id === "media");
    expect(media).toMatchObject({
        persist: "save",
        name: "mediaIds",
        valueType: "number",
        staging: { sessionField: "uploadSessionId" },
    });
    expect(media.actions.upload).toEqual({ endpoint: "stageProductImage" });
    expect(media.actions.remove).toBeUndefined();
    expect(media.actions.reorder).toBeUndefined();
});
