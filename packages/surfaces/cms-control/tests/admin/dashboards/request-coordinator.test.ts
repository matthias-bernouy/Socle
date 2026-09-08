import { describe, expect, test } from "bun:test";
import { DashboardActionScope } from "cms-control/components/admin/Resources/Dashboards/domain";

describe("dashboard action scope", () => {
    test("invalidates every pending result when leaving a detail", () => {
        const scope = new DashboardActionScope();
        const first = scope.beginAction();
        const second = scope.beginAction();
        scope.invalidate();
        expect(first()).toBe("stale");
        expect(second()).toBe("stale");
        expect(scope.beginAction()()).toBe("current");
    });

    test("overlapping uploads can finish in either order without invalidating each other", () => {
        const scope = new DashboardActionScope();
        const first = scope.beginAction();
        const second = scope.beginAction();
        expect(second()).toBe("current");
        expect(first()).toBe("current");
        expect(first()).toBe("stale");
    });
});
