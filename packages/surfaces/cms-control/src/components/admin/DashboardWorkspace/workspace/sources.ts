import { observeSource, type SourceObservation } from "@bernouy/components";
import template from "cms-control/static/dashboards/sources.html" with { type: "text" };
import { route } from "../../Resources/Dashboards/api";

/** Session and runtime definitions stay in page-owned light-DOM sources. */
export class WorkspaceSources {
    private runtime: HTMLElement | null = null;
    private stops: (() => void)[] = [];

    connect(
        host: HTMLElement,
        session: (state: SourceObservation) => void,
        runtime: (state: SourceObservation) => void,
    ): void {
        if (!host.querySelector("[data-workspace-sources]")) {
            const fragment = document.createElement("template");
            fragment.innerHTML = template as unknown as string;
            host.append(fragment.content);
        }
        const sessionSource = host.querySelector<HTMLElement>("[data-workspace-session]")!;
        sessionSource.setAttribute("cms-source", `${route("/api/dashboard-session")} as session`);
        this.runtime = host.querySelector<HTMLElement>("[data-workspace-runtime]")!;
        this.stops = [observeSource(sessionSource, session), observeSource(this.runtime, runtime)];
    }

    select(id: string | null): void {
        if (!this.runtime) {
            return;
        }
        if (!id) {
            this.runtime.removeAttribute("cms-source");
            return;
        }
        const spec = `${route(`/api/dashboard-session/dashboard?id=${encodeURIComponent(id)}`)} as runtime`;
        if (this.runtime.getAttribute("cms-source") === spec) {
            this.runtime.ownerDocument.dispatchEvent(new Event("cms-dashboard-workspace:read"));
        } else {
            this.runtime.setAttribute("cms-source", spec);
        }
    }

    disconnect(): void {
        for (const stop of this.stops) {
            stop();
        }
        this.stops = [];
        this.runtime = null;
    }
}
