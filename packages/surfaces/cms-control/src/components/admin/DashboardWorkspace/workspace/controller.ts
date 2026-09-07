import { Component } from "@bernouy/components/base";
import type { DashboardDefinition } from "@bernouy/cms-dashboards";
import type { SourceObservation } from "@bernouy/components";
import { WorkspaceSources } from "./sources";
import { dispatchDashboardNavigation } from "../events";
import type { DashboardRuntimeModel, DashboardSessionModel } from "../types";
import baseCss from "./styles/base.css" with { type: "text" };
import navigationCss from "./styles/navigation.css" with { type: "text" };
import template from "./template.html" with { type: "text" };
import { mountDashboardRuntime, renderHeader, renderViewNavigation, resolveViewPath } from "./view";

export abstract class DashboardWorkspaceController extends Component {
    protected dashboard: DashboardDefinition | null = null;
    protected runtime: DashboardRuntimeModel | null = null;
    private session: DashboardSessionModel | null = null;
    private readonly sources = new WorkspaceSources();

    constructor() {
        super({ css: `${baseCss}${navigationCss}`, template: template as unknown as string });
    }

    protected disconnectWorkspace(): void {
        this.sources.disconnect();
        delete document.documentElement.dataset.dashboardScope;
    }

    protected loadModel(): void {
        this.message("Loading dashboards…");
        this.sources.connect(this, this.sessionChanged, this.runtimeChanged);
    }

    private readonly sessionChanged = (state: SourceObservation): void => {
        if (!this.isConnected || state.disposed || state.loading) {
            return;
        }
        if (state.error) {
            this.sources.select(null);
            this.session = null;
            this.runtime = null;
            this.dashboard = null;
            delete document.documentElement.dataset.dashboardScope;
            this.publishNavigation(null, "");
            this.message(String(state.message ?? "Dashboard request failed"), true);
            return;
        }
        if (!state.loaded && !state.empty) {
            return;
        }
        this.session = state.data as DashboardSessionModel | null;
        const requested = new URL(window.location.href).searchParams.get("id") || "";
        const target = this.allDashboards().some((dashboard) => dashboard.id === requested)
            ? requested
            : (this.allDashboards()[0]?.id ?? "");
        this.loadDashboard(target);
    };

    protected loadDashboard(id: string): void {
        delete document.documentElement.dataset.dashboardScope;
        this.dashboard = this.allDashboards().find((dashboard) => dashboard.id === id) ?? null;
        this.runtime = null;
        if (!this.dashboard) {
            this.sources.select(null);
            if (this.isProfilePage()) {
                this.renderWorkspace();
                return;
            }
            this.message(this.allDashboards().length ? "Select a dashboard." : "No dashboard is available.");
            this.publishNavigation(null, "");
            return;
        }
        if (this.dashboard.status !== "published") {
            this.sources.select(null);
            this.renderWorkspace();
            return;
        }
        this.message("Loading dashboard…");
        this.sources.select(this.dashboard.id);
    }

    private readonly runtimeChanged = (state: SourceObservation): void => {
        if (!this.isConnected || state.disposed || !this.dashboard || this.dashboard.status !== "published") {
            return;
        }
        if (state.loading) {
            delete document.documentElement.dataset.dashboardScope;
            this.message("Loading dashboard…");
        } else if (state.error) {
            this.runtime = null;
            if (this.isProfilePage()) {
                this.renderWorkspace();
            } else {
                this.publishNavigation(null, "");
                this.message(String(state.message ?? "Dashboard request failed"), true);
            }
        } else if (state.loaded || state.empty) {
            this.runtime = state.data as DashboardRuntimeModel | null;
            this.renderWorkspace();
        }
    };

    protected selectView(requested: string): void {
        if (!this.dashboard || !this.runtime) {
            return;
        }
        const path = renderViewNavigation(this.shadowRoot!, this.runtime.dashboard, requested);
        const url = new URL(window.location.href);
        if (path) {
            url.searchParams.set("view", path);
        } else {
            url.searchParams.delete("view");
        }
        history.replaceState(null, "", url);
        this.publishNavigation(this.runtime.dashboard, path);
        mountDashboardRuntime(this.shadowRoot!, this.dashboard.id, this.runtime.dashboard, this.runtime.groups, path);
    }

    protected message(value: string, error = false): void {
        const message = this.shadowRoot?.querySelector<HTMLElement>("[data-message]");
        const content = this.shadowRoot?.querySelector<HTMLElement>("[data-content]");
        const profile = this.shadowRoot?.querySelector<HTMLElement>("[data-profile]");
        if (message) {
            message.textContent = value;
            message.hidden = !value;
            message.toggleAttribute("data-error", error);
        }
        if (content) {
            content.hidden = Boolean(value) || this.isProfilePage();
        }
        if (profile) {
            profile.hidden = Boolean(value) || !this.isProfilePage();
        }
    }

    private renderWorkspace(): void {
        if (this.isProfilePage()) {
            this.message("");
            const path = this.runtime ? resolveViewPath(this.runtime.dashboard, this.requestedView()) : "";
            this.publishNavigation(this.runtime?.dashboard ?? null, path);
            return;
        }
        if (!this.dashboard) {
            return;
        }
        this.message("");
        renderHeader(this.shadowRoot!, this.dashboard);
        if (!this.runtime) {
            this.shadowRoot!.querySelector<HTMLElement>("[data-view-navigation]")!.replaceChildren();
            this.shadowRoot!.querySelector<HTMLElement>("[data-runtime]")!.hidden = true;
            this.publishNavigation(null, "");
            return;
        }
        this.selectView(this.requestedView());
    }

    private allDashboards(): DashboardDefinition[] {
        return this.session?.dashboards ?? [];
    }

    private requestedView(): string {
        return new URL(window.location.href).searchParams.get("view") ?? "";
    }

    private isProfilePage(): boolean {
        return this.hasAttribute("profile");
    }

    private publishNavigation(dashboard: DashboardRuntimeModel["dashboard"] | null, path: string): void {
        dispatchDashboardNavigation({
            dashboards: this.allDashboards(),
            dashboard,
            path,
            subject: this.session?.subject ?? null,
            logoutUrl: this.session?.logoutUrl ?? "",
        });
    }
}
