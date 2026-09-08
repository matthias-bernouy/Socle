import { expect, test } from "bun:test";
import { commerceDefinitionWithDeferredDashboards } from "../../../catalog/support/deferredDashboards";

for (const [dashboardId, viewId, endpointId] of [
    ["commerce-offers", "offerDetail", "reviewOffer"],
    ["commerce-sellers", "sellerDetail", "reviewSeller"],
]) {
    test(`${viewId} declares independent review forms instead of page draft payloads`, async () => {
        const definition = await commerceDefinitionWithDeferredDashboards<any>();
        const dashboard = definition.artifacts.find((artifact: any) => artifact.view?.id === dashboardId).view;
        const detail = dashboard.views.find((view: any) => view.id === viewId);
        const actions = detail.actions.filter((action: any) => action.id !== "saveOffer");
        expect(actions).toHaveLength(viewId === "offerDetail" ? 3 : 2);
        for (const action of actions) {
            expect(action).not.toHaveProperty("endpoint");
            expect(action).not.toHaveProperty("after");
            expect(action.form.endpoint).toBe(endpointId);
            expect(action.form.hiddenFields).toEqual(
                expect.arrayContaining([
                    { name: "id", value: "$resource.id", type: "number" },
                    { name: "expectedVersion", value: "$resource.version", type: "number" },
                ]),
            );
            expect(action.form.fields.some((field: any) => field.name === "reason")).toBe(true);
        }
        const fields = detail.main.flatMap((section: any) => section.fields);
        expect(fields.some((field: any) => ["reviewReason", "minimumAmount", "maximumAmount"].includes(field.id))).toBe(
            false,
        );
        const source = definition.artifacts.find((artifact: any) => artifact.type === "source").source;
        const endpoint = source.endpoints.find((endpoint: any) => endpoint.endpointId === endpointId);
        expect(endpoint.params).toEqual([]);
        expect(endpoint.body.required).toContain("id");
        expect(endpoint.body.required).toContain("expectedVersion");
    });
}
