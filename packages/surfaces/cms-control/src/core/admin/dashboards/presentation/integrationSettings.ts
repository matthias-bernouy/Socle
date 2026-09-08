import type { DashboardDto, DashboardWidget } from "@bernouy/cms-dashboards";
import type { IntegrationInstallation } from "@bernouy/cms-integrations";
import type { DashboardSourceGroup } from "cms-control/api/_platform/dashboards.get";
import { parseUrn } from "@bernouy/cms-sources";

/** Connection fields remain owned by the installation; presentation uses ordinary detail views. */
export function appendIntegrationSettings(
    groups: DashboardSourceGroup[],
    installations: IntegrationInstallation[],
): void {
    const sourceIds = (installation: IntegrationInstallation) =>
        installation.artifacts
            .filter((artifact) => artifact.type === "source")
            .map((artifact) => parseUrn(artifact.id)?.source ?? artifact.id);
    for (const installation of installations) {
        const settings = installation.definitionSnapshot?.management?.settings;
        if (
            !settings?.fields.length ||
            settings.dashboardId ||
            installation.definitionSnapshot?.type === "collection"
        ) {
            continue;
        }
        const parent = installations.find((item) => item.id === installation.definitionSnapshot?.extensionOf?.kind);
        const ids = sourceIds(installation);
        const group = groups.find((candidate) =>
            (ids.length ? ids : parent ? sourceIds(parent) : []).includes(candidate.source.id),
        );
        if (!group) {
            continue;
        }
        const id = `integration-${installation.id}-settings`;
        const target = { management: { installationId: installation.id, operation: "settings" as const } };
        const widget: Extract<DashboardWidget, { widget: "w-detail" }> = {
            widget: "w-detail",
            id: "connection",
            source: target,
            title: { path: "", fallback: "Settings" },
            save: {
                ...target,
                label: "Save settings",
                valuesPath: "values",
                hiddenFields: [
                    { name: "expectedRevision", value: "$resource.savedRevision", type: "string", empty: "omit" },
                ],
            },
            main: [
                {
                    id: "connection",
                    title: "Connection",
                    fields: settings.fields.map((field) => ({
                        ...field,
                        name: field.name ?? field.path,
                        path: `values.${field.path}`,
                    })),
                },
            ],
        };
        const dashboard: DashboardDto = {
            id,
            source: group.source.id,
            meta: { name: ids.length ? "Connection" : `${installation.label} connection`, icon: "settings" },
            views: [widget],
        };
        if (!group.dashboards.some((view) => view.id === id)) {
            group.dashboards.push(dashboard);
            group.source.dashboardCount = group.dashboards.length;
        }
    }
}
