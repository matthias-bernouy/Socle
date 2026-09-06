import { expect, test } from "bun:test";
import {
    runDashboardWidgetAction,
    type DashboardViewActionContext,
} from "cms-control/components/admin/Resources/Dashboards/view/actions";
import { DetailResourceState } from "cms-control/components/admin/Resources/Dashboards/domain";
import { tableActionDashboard, tableActionGroup } from "../../fixtures/newsletter";
import { setupDashboardActionTests } from "../../setup";
import { deferred } from "../../support";

setupDashboardActionTests();

test("refreshes only the collection source after a mutation, preserving the dashboard shell", async () => {
    globalThis.fetch = (async () => Response.json({ ok: true })) as unknown as typeof fetch;
    const state = context();
    await runDashboardWidgetAction(state.context, { action: "clearQueue", widget: "queueTable" });
    expect(state.reloaded).toEqual(["queueTable"]);
    expect(state.rendered()).toBe(0);
});

test("does not refresh a different screen after leaving during a collection mutation", async () => {
    const response = deferred<Response>();
    globalThis.fetch = (() => response.promise) as unknown as typeof fetch;
    const state = context();
    const pending = runDashboardWidgetAction(state.context, { action: "clearQueue", widget: "queueTable" });
    state.coordinator.clear();
    response.resolve(Response.json({ ok: true }));
    await pending;
    expect(state.reloaded).toEqual([]);
    expect(state.rendered()).toBe(0);
});

function context() {
    const reloaded: string[] = [];
    let rendered = 0;
    const coordinator = new DetailResourceState();
    const context: DashboardViewActionContext = {
        group: tableActionGroup(),
        dashboard: tableActionDashboard(),
        detail: null,
        drafts: new Map(),
        render: () => {
            rendered += 1;
        },
        reload: () => {
            throw new Error("Unexpected detail reload");
        },
        reloadCollection: (widget) => {
            reloaded.push(widget);
        },
        clearDetail: () => {
            throw new Error("Unexpected navigation");
        },
        openDetail: () => {
            throw new Error("Unexpected navigation");
        },
        actionCoordinator: coordinator,
    };
    return { context, reloaded, rendered: () => rendered, coordinator };
}
