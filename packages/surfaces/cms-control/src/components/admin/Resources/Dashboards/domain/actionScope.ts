export type DashboardActionCompletion = "current" | "stale";

/** Ignore upload/download results belonging to a detail that has been left. */
export class DashboardActionScope {
    private generation = 0;

    invalidate(): void {
        this.generation += 1;
    }

    beginAction(): () => DashboardActionCompletion {
        const generation = this.generation;
        let finished = false;
        return () => {
            if (finished || generation !== this.generation) {
                return "stale";
            }
            finished = true;
            return "current";
        };
    }
}
