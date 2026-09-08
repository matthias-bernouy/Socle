import "../../detail/boundDetail";
import { setSourceData } from "@bernouy/components";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DashboardNav } from "cms-control/components/admin/Resources/Dashboards/navigation/DashboardNav";
import { DashboardView } from "cms-control/components/admin/Resources/Dashboards/view/DashboardView";
import { DASHBOARD_SELECTION_EVENT } from "cms-control/components/admin/Resources/Dashboards/api";
import { DashboardActionScope } from "cms-control/components/admin/Resources/Dashboards/domain";
import { groups, selectedDashboard } from "./fixtures";
const originalFetch = globalThis.fetch;

describe("dashboard deep links", () => {
    beforeEach(() => {
        globalThis.fetch = (async () => Response.json([])) as unknown as typeof fetch;
        document.body.replaceChildren();
        window.history.replaceState(null, "", `/admin/sources?source=commerce&dashboard=${selectedDashboard}`);
    });
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    test("preserves the URL selection while bound dashboard data hydrates", async () => {
        for (const component of [new DashboardNav(), new DashboardView()]) {
            document.body.append(component);
            expect(selectionOf(component)).toBe(selectedDashboard);

            const core = document.createElement("cms-binding-core");
            component.remove();
            core.append(component);
            document.body.append(core);
            const source =
                component instanceof DashboardNav
                    ? component
                    : component.querySelector<HTMLElement>("[data-dashboard-list-source]")!;
            source.setAttribute("cms-source", "");
            setSourceData(source, groups);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(selectionOf(component)).toBe(selectedDashboard);
            component.remove();
        }
    });

    test("invalidates pending action resources on navigation and disconnect", () => {
        const component = new DashboardView();
        document.body.append(component);
        const resources = (component as unknown as { actionScope: DashboardActionScope }).actionScope;
        const finishNavigation = resources.beginAction();

        window.dispatchEvent(
            new CustomEvent(DASHBOARD_SELECTION_EVENT, {
                detail: { source: "commerce", dashboard: selectedDashboard },
            }),
        );

        expect(finishNavigation()).toBe("stale");
        const finishDisconnect = resources.beginAction();
        component.remove();
        expect(finishDisconnect()).toBe("stale");
    });
});

function selectionOf(component: HTMLElement): string {
    return (component as unknown as { selectedDashboard: string }).selectedDashboard;
}
