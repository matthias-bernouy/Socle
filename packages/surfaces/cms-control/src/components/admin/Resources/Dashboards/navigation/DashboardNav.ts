import sources from "cms-control/static/admin/_content/sources/_runtime/navigation.html" with { type: "text" };
import "../runtime/mounting/input";
import { renderSourceManagement, sourceForInstallation } from "./management";
import type { IntegrationInstallationRow } from "../../Integrations/model";
import { Component } from "@bernouy/components/base";
import {
    currentSelection,
    DASHBOARD_SELECTION_EVENT,
    defaultDashboardSource,
    dispatchDashboardSelection,
    route,
    replaceSelectionUrl,
    type DashboardSelection,
} from "../api";
import {
    reconcileNavigation,
    renderDashboardNavigation,
    renderDashboardNavigationExample,
} from "./DashboardNavRendering";
import css from "./nav.css" with { type: "text" };
import template from "./nav.html" with { type: "text" };
import type { DashboardSourceGroup } from "../types";

export class DashboardNav extends Component {
    private installations: IntegrationInstallationRow[] = [];
    private groups: DashboardSourceGroup[] = [];
    private selectedSource = "";
    private selectedDashboard = "";
    private readonly boundValue = (event: Event): void => {
        const { kind, value } = (event as CustomEvent).detail;
        if (!Array.isArray(value)) {
            return;
        }
        if (kind === "groups") {
            this.groups = value;
            this.selectedSource ||= defaultDashboardSource(this.groups);
            this.ensureDashboardSelection();
        } else if (kind === "installations") {
            this.installations = value;
        } else {
            return;
        }
        this.render();
    };

    constructor() {
        super({ css: css as unknown as string, template: template as unknown as string });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.syncFromUrl();
        this.shadowRoot!.addEventListener("click", this.onClick);
        window.addEventListener("popstate", this.onPopState);
        window.addEventListener("cms-resources:route", this.onResourceRoute);
        window.addEventListener(DASHBOARD_SELECTION_EVENT, this.onExternalSelection as EventListener);
        this.query<HTMLElement>("[data-add-source]").setAttribute("href", route("/admin/sources?tab=catalogue"));
        this.updateCatalogueAction();
        this.addEventListener("dashboard:bound-value", this.boundValue);
        this.startBoundSource();
    }

    disconnectedCallback(): void {
        this.shadowRoot?.removeEventListener("click", this.onClick);
        window.removeEventListener("popstate", this.onPopState);
        window.removeEventListener("cms-resources:route", this.onResourceRoute);
        window.removeEventListener(DASHBOARD_SELECTION_EVENT, this.onExternalSelection as EventListener);
        this.removeEventListener("dashboard:bound-value", this.boundValue);
    }

    private startBoundSource(): void {
        if (this.isExampleMode()) {
            renderDashboardNavigationExample(this.query<HTMLElement>("w13c-lateral-menu"));
            return;
        }
        if (!this.querySelector("[data-nav-list-source]")) {
            const template = document.createElement("template");
            template.innerHTML = sources as unknown as string;
            for (const source of Array.from(template.content.querySelectorAll("[cms-source]"))) {
                source.setAttribute("cms-source", route(source.getAttribute("cms-source")!));
            }
            this.append(template.content.cloneNode(true));
        }
    }

    private select(sourceId: string, dashboardId = ""): void {
        this.selectedSource = sourceId;
        this.selectedDashboard = dashboardId;
        this.ensureDashboardSelection();
        const selection = this.selection();
        replaceSelectionUrl(selection);
        dispatchDashboardSelection(selection);
        this.render();
    }

    private ensureDashboardSelection(): void {
        const group = this.activeGroup();
        if (!group) {
            this.selectedDashboard = "";
            return;
        }
        if (!group.dashboards.some((dashboard) => dashboard.id === this.selectedDashboard)) {
            this.selectedDashboard = group.dashboards[0]?.id ?? "";
        }
    }

    private render(): void {
        const menu = this.query<HTMLElement>("w13c-lateral-menu");
        const params = new URL(window.location.href).searchParams;
        const installation = params.get("integration");
        if (installation) {
            this.selectedSource = sourceForInstallation(installation, this.installations) ?? this.selectedSource;
        }
        this.updateCatalogueAction();
        const next = document.createElement("div");
        renderDashboardNavigation(
            next,
            this.groups,
            params.has("tab") || params.has("setup") ? "" : this.selectedSource,
            installation ? "" : this.selectedDashboard,
        );
        renderSourceManagement(next, this.selectedSource, this.installations);
        reconcileNavigation(menu, next);
    }

    private updateCatalogueAction(): void {
        const params = new URL(window.location.href).searchParams;
        this.query<HTMLElement>("[data-add-source]").toggleAttribute(
            "active",
            params.get("tab") === "catalogue" || params.has("setup"),
        );
    }

    private onResourceRoute = (): void => this.render();

    private activeGroup(): DashboardSourceGroup | null {
        return this.groups.find((group) => group.source.id === this.selectedSource) ?? null;
    }

    private selection(): DashboardSelection {
        return { source: this.selectedSource, dashboard: this.selectedDashboard };
    }

    private syncFromUrl(): void {
        const selection = currentSelection();
        this.selectedSource = selection.source;
        this.selectedDashboard = selection.dashboard;
    }

    private isExampleMode(): boolean {
        return (
            this.hasAttribute("example") ||
            window.location.pathname.replace(/\/+$/, "").endsWith("/admin/sources/example")
        );
    }

    private onClick = (event: Event): void => {
        const target = event.target as Element | null;
        const dashboardButton = target?.closest<HTMLElement>("[data-dashboard]");
        if (dashboardButton?.dataset.source && dashboardButton.dataset.dashboard) {
            this.select(dashboardButton.dataset.source, dashboardButton.dataset.dashboard);
            return;
        }
        const sourceButton = target?.closest<HTMLElement>("[data-source]");
        if (sourceButton?.dataset.source) {
            this.select(sourceButton.dataset.source);
        }
    };

    private onPopState = (): void => {
        this.syncFromUrl();
        this.ensureDashboardSelection();
        this.render();
        dispatchDashboardSelection(currentSelection());
    };

    private onExternalSelection = (event: CustomEvent<DashboardSelection>): void => {
        this.selectedSource = event.detail.source;
        this.selectedDashboard = event.detail.dashboard;
        this.ensureDashboardSelection();
        this.render();
    };

    private query<T extends Element>(selector: string): T {
        return this.shadowRoot!.querySelector(selector) as T;
    }
}

if (!customElements.get("cms-dashboards-nav")) {
    customElements.define("cms-dashboards-nav", DashboardNav);
}
