import type { DashboardSourceGroup } from "../../types";
import type { IntegrationInstallationRow } from "../../../Integrations/model";
import { route } from "../../api";

type Item = {
    identity: string;
    label: string;
    source: string;
    dashboard: string;
    href: string;
    icon: string;
    svg: string;
    nested: boolean;
    active: boolean;
    hidden: boolean;
};

/** Project navigation values; existing positional items survive selection and equal-definition refreshes. */
export function navigationContext() {
    let items: Item[] = [];
    return (
        groups: DashboardSourceGroup[],
        installations: IntegrationInstallationRow[],
        source: string,
        dashboard: string,
        catalogue: boolean,
        selectedInstallation: string | null,
        example: boolean,
    ) => {
        const next: Item[] = [];
        const append = (item: Item) => {
            const previous = items[next.length];
            next.push(previous?.identity === item.identity ? Object.assign(previous, item) : item);
        };
        for (const group of groups) {
            const id = group.source.id;
            append({
                identity: `source:${id}`,
                label: group.source.name,
                source: example ? "" : id,
                dashboard: "",
                href: "",
                icon: group.source.icon ?? "database",
                svg: group.source.svg ?? "",
                nested: false,
                active: id === source && !catalogue,
                hidden: false,
            });
            for (const entry of group.dashboards) {
                append({
                    identity: `dashboard:${id}:${entry.id}`,
                    label: entry.meta?.name ?? entry.id,
                    source: example ? "" : id,
                    dashboard: example ? "" : entry.id,
                    href: "",
                    icon: entry.meta?.icon ?? "layout",
                    svg: entry.meta?.svg ?? "",
                    nested: true,
                    active: !selectedInstallation && entry.id === dashboard,
                    hidden: catalogue || id !== source || (!example && group.dashboards.length < 2),
                });
            }
            const parent = installations.find((item) => item.sourceIds?.includes(id));
            if (!parent) {
                continue;
            }
            for (const entry of [parent, ...installations.filter((item) => item.extensionOf?.kind === parent.id)]) {
                append({
                    identity: `installation:${id}:${entry.id}`,
                    label: entry === parent ? "Settings & health" : `${entry.label} settings`,
                    source: "",
                    dashboard: "",
                    href: route(
                        `/admin/sources?source=${encodeURIComponent(id)}&integration=${encodeURIComponent(entry.id)}`,
                    ),
                    icon: "",
                    svg: "",
                    nested: true,
                    active: entry.id === selectedInstallation,
                    hidden: id !== source,
                });
            }
        }
        items = next;
        return {
            navItems: items,
            navEmpty: groups.length === 0,
            navAddActive: catalogue,
            navAddHref: route("/admin/sources?tab=catalogue"),
        };
    };
}

export const exampleGroups: DashboardSourceGroup[] = [
    {
        source: {
            id: "example",
            urn: "urn:example",
            name: "Example source",
            icon: "database",
            endpointCount: 0,
            dashboardCount: 1,
            readonly: true,
        },
        endpoints: [],
        dashboards: [
            { id: "example", source: "example", meta: { name: "Product dashboard", icon: "layout" }, views: [] },
        ],
    },
];
