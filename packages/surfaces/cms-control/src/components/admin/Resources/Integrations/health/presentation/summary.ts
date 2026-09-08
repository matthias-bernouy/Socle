import type { IntegrationHealthEnvelope } from "@bernouy/cms-integrations";

export function summarizeHealth(health?: IntegrationHealthEnvelope, failed = false) {
    const report = health?.report;
    const fresh = !failed && health?.observation === "valid" && health.freshness === "fresh";
    const ready = fresh && report?.status === "ready" && report.checks.every((check) => check.status === "ok");
    const count = report
        ? `${report.checks.filter((check) => check.status === "ok").length}/${report.checks.length} checks passed${fresh ? "" : " · last observation"}`
        : "No check results";
    const label = failed
        ? "Unavailable"
        : !health
          ? "Checking service…"
          : !fresh
            ? health.freshness === "stale"
                ? "Stale observation"
                : "Not observed"
            : (report?.status.replaceAll("_", " ") ?? "Unknown");
    return { ready, observed: Boolean(fresh && report), label: ready ? "✓ Ready" : label, count };
}
