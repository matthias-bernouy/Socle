import { expect, test } from "bun:test";
import { applyDashboardSourceOverlays, type Dashboard } from "@bernouy/cms-dashboards";
import { dashboard, sourceOverlay } from "./sourceOverlayDashboardFixtures";

for (const foreign of [false, true]) {
    test(`overlays recognize a native save on the ${foreign ? "foreign" : "same"} source`, () => {
        const input = structuredClone(dashboard);
        const detail = input.views[1] as Extract<Dashboard["views"][number], { widget: "w-detail" }>;
        detail.actions = [];
        detail.save = {
            endpoint: "createUserPersonalInformation",
            ...(foreign ? { sourceId: "another-source" } : {}),
        };
        const result = applyDashboardSourceOverlays(input, [sourceOverlay]);
        const enriched = result.views[1] as typeof detail;
        const fields = enriched.main.flatMap((section) => ("fields" in section ? section.fields : []));
        expect(fields.find((field) => field.id === "company")?.type).toBe(foreign ? "readonly" : "text");
        expect(enriched.save).toEqual(detail.save);
        expect(enriched.actions).toEqual([]);
        expect(
            detail.main
                .flatMap((section) => ("fields" in section ? section.fields : []))
                .some((field) => field.id === "company"),
        ).toBe(false);
    });
}
