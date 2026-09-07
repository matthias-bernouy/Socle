import type { DashboardAction } from "@bernouy/cms-dashboards";
import markup from "cms-control/static/admin/_content/sources/_runtime/detail/actions.html" with { type: "text" };
import { matchesDashboardVisibility } from "../../../runtime/expressions";

export function composeActions(): DocumentFragment {
    const template = document.createElement("template");
    template.innerHTML = markup as unknown as string;
    return template.content;
}

/** Data-only layout: the binding owns all buttons, groups and menu items. */
export function actionLayout(actions: DashboardAction[]) {
    const entries = actions.map((action) => ({
        ...action,
        color: action.tone === "primary" ? "primary" : action.tone === "danger" ? "danger" : "",
        variant: action.tone === "primary" ? "filled" : action.tone === "danger" ? "ghost" : "outlined",
        menuColor: action.tone === "danger" ? "danger" : "",
    }));
    type Entry = (typeof entries)[number];
    let previous: Entry[] = [];
    let layout: { primary: Entry[]; groups: { label: string; actions: Entry[] }[] } = { primary: [], groups: [] };
    return (fields: Record<string, unknown>, resource: unknown) => {
        const visible =
            resource == null
                ? []
                : entries.filter((action) => matchesDashboardVisibility(action.visibleWhen, { fields, resource }));
        // Retain unchanged groups so unrelated refreshes preserve an open menu's focus.
        if (visible.length === previous.length && visible.every((entry, index) => entry === previous[index])) {
            return layout;
        }
        previous = visible;
        const buttons = visible.filter((action) => action.placement !== "more");
        const overflow = [...buttons.slice(3), ...visible.filter((action) => action.placement === "more")];
        const groups = new Map<string, Entry[]>();
        for (const action of overflow) {
            const label = action.section ?? "Other actions";
            const group = groups.get(label) ?? [];
            group.push(action);
            groups.set(label, group);
        }
        layout = {
            primary: buttons.slice(0, 3),
            groups: Array.from(groups, ([label, actions]) => ({ label, actions })),
        };
        return layout;
    };
}
