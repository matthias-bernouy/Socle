import { expect, test } from "bun:test";
import { runDashboardWidgetAction } from "cms-control/components/admin/Resources/Dashboards/view/actions";
import { detailKey } from "cms-control/components/admin/Resources/Dashboards/domain";
import { setupDashboardActionTests } from "../../setup";
import { deferred, resourceActionContext } from "../../support";

setupDashboardActionTests();

test("acknowledges the submitted snapshot while keeping newer and unrelated field edits", async () => {
    const response = deferred<Response>();
    globalThis.fetch = (() => response.promise) as unknown as typeof fetch;
    const context = resourceActionContext({
        detail: { collection: "emailerSettings", row: "default" },
        resources: [],
        reload() {
            throw new Error("Unexpected reload");
        },
    });
    const key = detailKey("emailerSettings", "default");
    context.drafts.set(key, { smtpHost: "submitted.test" });
    const acknowledged: unknown[] = [];
    context.acknowledgeDetailFields = (collection, row, fields) => {
        acknowledged.push({ collection, row, fields });
    };
    const action = runDashboardWidgetAction(context, { action: "saveSettings", resource: { provider: "supabase" } });
    context.drafts.set(key, { smtpHost: "newer.test", smtpUser: "new user" });
    response.resolve(Response.json({ provider: "supabase", smtpHost: "normalized.test" }));
    await action;
    expect(context.drafts.get(key)).toEqual({ smtpHost: "newer.test", smtpUser: "new user" });
    expect(acknowledged).toEqual([
        { collection: "emailerSettings", row: "default", fields: { smtpHost: "submitted.test" } },
    ]);
});

test("does not acknowledge or remove edits when saving fails", async () => {
    globalThis.fetch = (async () =>
        Response.json({ error: "Validation failed" }, { status: 422 })) as unknown as typeof fetch;
    const context = resourceActionContext({
        detail: { collection: "emailerSettings", row: "default" },
        resources: [],
        reload() {
            throw new Error("Unexpected reload");
        },
    });
    const key = detailKey("emailerSettings", "default");
    context.drafts.set(key, { smtpHost: "draft.test" });
    let acknowledgements = 0;
    context.acknowledgeDetailFields = () => {
        acknowledgements += 1;
    };
    await runDashboardWidgetAction(context, { action: "saveSettings", resource: { provider: "supabase" } });
    expect(acknowledgements).toBe(0);
    expect(context.drafts.get(key)).toEqual({ smtpHost: "draft.test" });
});
