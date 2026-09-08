import { expect, test } from "bun:test";
import { summarizeHealth } from "cms-control/components/admin/Resources/Integrations/health/presentation/summary";
import { health } from "./fixture";

test("global readiness requires a fresh valid ready report and passing checks", () => {
    const ready = {
        ...health,
        report: { ...health.report, status: "ready", checks: [{ id: "connection", status: "ok" }] },
    } as const;
    expect(summarizeHealth(ready as never).ready).toBe(true);
    expect(summarizeHealth({ ...ready, freshness: "stale" } as never).ready).toBe(false);
    expect(summarizeHealth({ ...ready, observation: "invalid_report" } as never).ready).toBe(false);
    expect(summarizeHealth(ready as never, true).ready).toBe(false);
    expect(summarizeHealth(health as never).ready).toBe(false);
    expect(summarizeHealth().ready).toBe(false);
    expect(summarizeHealth({ ...ready, report: null, observation: "unsupported" } as never).observed).toBe(false);
});
