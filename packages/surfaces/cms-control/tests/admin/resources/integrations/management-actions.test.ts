import { expect, test } from "bun:test";
import { executeEndpointAction } from "cms-control/components/admin/Resources/Dashboards/runtime/actions/endpoint";

test("removed management action mapping cannot bypass native forms", async () => {
    await expect(
        executeEndpointAction(
            {} as never,
            [],
            {
                id: "publish",
                label: "Publish",
                management: { installationId: "provider", action: "action", actionId: "publish" },
            } as never,
            {},
        ),
    ).rejects.toThrow("does not declare an endpoint");
});
