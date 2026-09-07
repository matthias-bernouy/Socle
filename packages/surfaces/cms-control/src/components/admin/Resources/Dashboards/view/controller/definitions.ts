import { observeSource, setSourceContext } from "@bernouy/components";
import definitions from "cms-control/static/admin/_content/sources/_runtime/definitions.html" with { type: "text" };
import { route } from "../../api";
import type { DashboardSourceGroup } from "../../types";

type Completion = { resolve: () => void; reject: (error: Error) => void };

/** Definitions describe widget composition; the page binding owns their read lifecycle. */
export class DashboardDefinitions {
    private stop: (() => void) | undefined;
    private pending: Completion[] = [];

    connect(host: HTMLElement, accept: (groups: DashboardSourceGroup[], render: boolean) => void): void {
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
            if (state.disposed) {
                this.complete(new Error("Dashboard definitions were disconnected"));
            } else if (state.error) {
                this.complete(new Error(String(state.message ?? "Dashboard definitions could not be loaded")));
            } else if ((state.loaded || state.empty) && Array.isArray(state.data)) {
                accept(state.data, this.pending.length === 0);
                this.complete();
            }
        });
    }

    reload(host: HTMLElement): Promise<void> {
        if (!host.isConnected || !this.stop) {
            return Promise.reject(new Error("Dashboard definitions are unavailable"));
        }
        return new Promise((resolve, reject) => {
            this.pending.push({ resolve, reject });
            host.ownerDocument.dispatchEvent(new Event("dashboard:definitions-changed"));
        });
    }

    disconnect(): void {
        this.stop?.();
        this.stop = undefined;
        this.complete(new Error("Dashboard definitions were disconnected"));
    }

    private complete(error?: Error): void {
        const pending = this.pending.splice(0);
        for (const completion of pending) {
            if (error) {
                completion.reject(error);
            } else {
                completion.resolve();
            }
        }
    }
}
