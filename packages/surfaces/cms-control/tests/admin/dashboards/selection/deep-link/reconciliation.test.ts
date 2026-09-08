import { reloadSource } from "@bernouy/components";
import "../../detail/boundDetail";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
    actionDefinitionGroups,
    dashboardViewInternals,
    groupsWithFirstDashboard,
    selectedDashboard,
    type DashboardViewInternals,
} from "./fixtures";

const realFetch = globalThis.fetch;

describe("dashboard deep links", () => {
    beforeEach(() => {
        document.body.replaceChildren();
        window.history.replaceState(null, "", `/admin/sources?source=commerce&dashboard=${selectedDashboard}`);
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    test("keeps the newest dashboard definitions when reloads resolve out of order", async () => {
        const responses: Array<(response: Response) => void> = [];
        globalThis.fetch = (() =>
            new Promise<Response>((resolve) => responses.push(resolve))) as unknown as typeof fetch;
        const component = dashboardViewInternals();

        await mountDefinitions(component);
        const first = reloadSource(
            (component as unknown as HTMLElement).querySelector("[data-dashboard-list-source]")!,
        );
        const second = reloadSource(
            (component as unknown as HTMLElement).querySelector("[data-dashboard-list-source]")!,
        );
        responses.at(-1)!(Response.json(groupsWithFirstDashboard("new-dashboard")));
        await second;
        responses[0]!(Response.json(groupsWithFirstDashboard("stale-dashboard")));
        await first;

        expect(component.groups[0]?.dashboards[0]?.id).toBe("new-dashboard");
    });

    test("does not reopen a detail removed from refreshed definitions", () => {
        const component = dashboardViewInternals();
        component.groups = groupsWithFirstDashboard(selectedDashboard).map((group) => ({
            ...group,
            dashboards: group.dashboards.map((dashboard) => ({ ...dashboard, views: [] })),
        }));

        component.openDetail("removedDetail", "removed-1");

        expect(component.detailSelection).toBeNull();
    });

    test("removes a detail deep link when refreshed definitions drop its widget", async () => {
        const component = dashboardViewInternals();

        window.history.replaceState(
            null,
            "",
            `/admin/sources?source=commerce&dashboard=${selectedDashboard}&collection=removedDetail&row=removed-1`,
        );
        globalThis.fetch = (async () =>
            Response.json(
                groupsWithFirstDashboard(selectedDashboard).map((group) => ({
                    ...group,
                    dashboards: group.dashboards.map((dashboard) => ({ ...dashboard, views: [] })),
                })),
            )) as unknown as typeof fetch;

        await mountDefinitions(component);
        component.detailSelection = { collection: "removedDetail", row: "removed-1" };
        await reloadSource((component as unknown as HTMLElement).querySelector("[data-dashboard-list-source]")!);

        expect(component.detailSelection).toBeNull();
        expect(new URL(window.location.href).searchParams.has("collection")).toBeFalse();
        expect(new URL(window.location.href).searchParams.has("row")).toBeFalse();
    });

    test("invalidates an action when refreshed definitions remove its detail", async () => {
        const component = dashboardViewInternals();
        component.groups = actionDefinitionGroups(true);
        component.detailSelection = { collection: "createForm", row: "__new__" };

        globalThis.fetch = (async () => Response.json(actionDefinitionGroups(false))) as unknown as typeof fetch;

        await mountDefinitions(component);
        component.detailSelection = { collection: "createForm", row: "__new__" };
        const finish = component.actionScope.beginAction();
        await reloadSource((component as unknown as HTMLElement).querySelector("[data-dashboard-list-source]")!);

        expect(component.detailSelection).toBeNull();
        expect(finish()).toBe("stale");
        component.openDetail("createdDetail", "created-1");
        expect(component.detailSelection).toEqual({ collection: "createdDetail", row: "created-1" });
    });
});

async function mountDefinitions(view: DashboardViewInternals): Promise<void> {
    const core = document.createElement("cms-binding-core");
    core.append(view as unknown as HTMLElement);
    document.body.append(core);
    await new Promise((resolve) => setTimeout(resolve, 0));
}
