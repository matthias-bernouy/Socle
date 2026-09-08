import type { SubmitAction } from "../../runtime/actions/forms";
import type { DashboardDto } from "@bernouy/cms-dashboards";
import type { DashboardActionCompletion, DetailSelection } from "../../domain";
import type { DashboardSourceGroup } from "../../types";

export type DashboardViewActionContext = {
    submit?: SubmitAction;
    group: DashboardSourceGroup | null;
    groups?: DashboardSourceGroup[];
    dashboard: DashboardDto | null | undefined;
    detail: DetailSelection | null;
    drafts: Map<string, Record<string, unknown>>;
    filters?: ReadonlyMap<string, Readonly<Record<string, string>>>;
    reload: (collection: string, row: string) => void;
    acknowledgeDetailFields?: (collection: string, row: string, fields: Record<string, unknown>) => void;
    restoreDetailField?: (
        collection: string,
        row: string,
        field: string,
        submitted: unknown,
        previous: unknown,
    ) => void;
    openDetail: (collection: string, row: string) => void;
    navigateDetail?: (collection: string, row: string) => void;
    actionCoordinator?: { beginAction: () => () => DashboardActionCompletion };
};
