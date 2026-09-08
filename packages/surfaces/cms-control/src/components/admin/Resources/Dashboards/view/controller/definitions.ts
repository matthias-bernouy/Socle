import { observeSource, setSourceContext } from "@bernouy/components";
import definitions from "cms-control/static/admin/_content/sources/_runtime/definitions.html" with { type: "text" };
import { route } from "../../api";
import type { DashboardSourceGroup } from "../../types";

/** Definitions describe widget composition; the page binding owns their read lifecycle. */
export class DashboardDefinitions {
    private stop: (() => void) | undefined;

    connect(host: HTMLElement, accept: (groups: DashboardSourceGroup[]) => void): void {
        let source = host.querySelector<HTMLElement>("[data-dashboard-list-source]");
        if (!source) {
            const template = document.createElement("template");
            template.innerHTML = definitions as unknown as string;
            source = template.content.querySelector<HTMLElement>("[data-dashboard-list-source]")!;
            source.setAttribute("cms-source", `${route("/api/dashboards")} as dashboards`);
            host.append(template.content);
        }
        setSourceContext(source, (data) => {
            const id = host.getAttribute("dashboard-id");
            return {
                definitionsEmbedded: host.hasAttribute("embedded"),
                definitionsUnavailable:
                    Boolean(id) &&
                    Array.isArray(data) &&
                    !data.some((group: DashboardSourceGroup) =>
                        group.dashboards.some((dashboard) => dashboard.id === id),
                    ),
            };
        });
        this.stop = observeSource(source, (state) => {
            if (
                !state.disposed &&
                !state.error &&
                !state.refreshError &&
                !state.refreshing &&
                (state.loaded || state.empty) &&
                Array.isArray(state.data)
            ) {
                accept(state.data);
            }
        });
    }

    disconnect(): void {
        this.stop?.();
        this.stop = undefined;
    }
}
