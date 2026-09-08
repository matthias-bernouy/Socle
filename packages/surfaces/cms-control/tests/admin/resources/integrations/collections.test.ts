import { afterEach, expect, test } from "bun:test";
import { integrationRouteUrl } from "cms-control/components/admin/Resources/Integrations/api";

afterEach(() => history.replaceState(null, "", "/"));
test("collection routes stay under Blocs", () => {
    history.replaceState(null, "", "/admin/blocs");
    expect(integrationRouteUrl({ view: "list", tab: "catalogue" })).toBe("/admin/blocs?tab=catalogue");
    expect(integrationRouteUrl({ view: "installation", id: "design" })).toBe("/admin/blocs?integration=design");
});
