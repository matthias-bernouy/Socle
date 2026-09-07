import { readSourceData } from "@bernouy/components";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { dashboardUserOptions, route } from "../../../api";
import type { DashboardUserOption } from "../../../api";
import { matchesDashboardVisibility } from "../../../runtime/expressions";
import type { DashboardDirectory } from "./Directory";

export function directoryContext(host: HTMLElement, fields: DashboardField[]) {
    const users = fields.filter((field) => field.type === "cms-user");
    let requested = false;
    return (values: Record<string, unknown>, resource: unknown) => {
        requested ||=
            resource != null &&
            users.some((field) => matchesDashboardVisibility(field.visibleWhen, { fields: values, resource }));
        const directory = host.querySelector<DashboardDirectory>("cms-dashboard-directory");
        const data = directory ? readSourceData(directory) : undefined;
        const options = Array.isArray(data) ? dashboardUserOptions(data as DashboardUserOption[]) : [];
        const failed = directory?.failed === true;
        return {
            detailUsersUrl: requested ? route("/api/users") : "",
            detailUsersFailed: failed,
            detailUsersHint: failed ? "Unable to load CMS users. Focus or click to retry." : "",
            detailUsersOptions: Object.fromEntries(
                users.map((field) => {
                    const selected = typeof values[field.id] === "string" ? (values[field.id] as string) : "";
                    return [
                        field.id,
                        Array.isArray(data) && selected && !options.some((option) => option.value === selected)
                            ? [...options, { value: selected, label: `Unknown CMS user · ${selected}` }]
                            : options,
                    ];
                }),
            ),
        };
    };
}
