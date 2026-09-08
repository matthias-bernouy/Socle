import { expect, test } from "bun:test";
import { appendIntegrationSettings } from "cms-control/core/admin/dashboards/presentation/integrationSettings";
import type { DashboardSourceGroup } from "cms-control/api/_platform/dashboards.get";
import type { IntegrationInstallation } from "@bernouy/cms-integrations";

export function settingsFixture() {
    const groups: DashboardSourceGroup[] = [
        {
            source: {
                id: "shop",
                urn: "urn:cms:source:shop",
                name: "Shop",
                endpointCount: 0,
                dashboardCount: 0,
                readonly: false,
            },
            dashboards: [],
            endpoints: [],
        },
    ];
    const installations = [
        {
            id: "commerce",
            artifacts: [{ type: "source", id: "shop" }],
            definitionSnapshot: { type: "source", management: { schemaVersion: 1, settings: { fields: [] } } },
        },
        {
            id: "payment",
            label: "Payment",
            artifacts: [],
            definitionSnapshot: {
                type: "source",
                extensionOf: { kind: "commerce" },
                management: {
                    schemaVersion: 1,
                    settings: {
                        readFunctionId: "read",
                        saveFunctionId: "save",
                        fields: [
                            { id: "country", type: "text", path: "market.country", label: "Country", required: true },
                            { id: "key", type: "secret-ref", path: "apiKey", label: "API key" },
                        ],
                    },
                },
            },
        },
    ] as unknown as IntegrationInstallation[];
    appendIntegrationSettings(groups, installations);
    return { groups, installations };
}

test("connection views join the actual source, keep typed controls and use native management saves", () => {
    const { groups, installations } = settingsFixture();
    const view = groups[0]!.dashboards[0]!;
    expect(view.source).toBe("shop");
    expect(view.id).toBe("integration-payment-settings");
    expect(view.views[0]).toMatchObject({
        widget: "w-detail",
        source: { management: { installationId: "payment", operation: "settings" } },
        save: {
            management: { installationId: "payment", operation: "settings" },
            valuesPath: "values",
            hiddenFields: [
                { name: "expectedRevision", value: "$resource.savedRevision", type: "string", empty: "omit" },
            ],
        },
        main: [
            {
                fields: [
                    { id: "country", path: "values.market.country", name: "market.country" },
                    { id: "key", path: "values.apiKey", name: "apiKey", type: "secret-ref" },
                ],
            },
        ],
    });
    appendIntegrationSettings(groups, installations);
    expect(groups[0]!.dashboards).toHaveLength(1);
    expect(JSON.stringify(view)).not.toContain("health");
    expect(JSON.stringify(view)).not.toContain("apply-settings");
});
