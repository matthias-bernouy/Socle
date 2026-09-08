import type { DashboardActionCompletion } from "../../domain";

/** A completion is consumed once, including error and stale-result paths. */
export function once(finish: (() => DashboardActionCompletion) | undefined): () => DashboardActionCompletion {
    let completion: DashboardActionCompletion | undefined;
    return () => (completion ??= finish?.() ?? "current");
}
