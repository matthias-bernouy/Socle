import definitions from "cms-control/static/admin/_content/sources/_runtime/definitions.html" with { type: "text" };
import "../../runtime/mounting/input";
import { defaultDashboardSource, route, type DashboardSelection } from "../../api";
import { detailReloadEvent, reloadCollection } from "../../runtime/reload";
import type { DashboardSourceGroup } from "../../types";
import type { DashboardViewActionContext } from "../actions";
import { renderDashboardShell, renderExampleShell } from "../rendering";
import { DashboardStateController } from "./DashboardStateController";

export class DashboardViewController extends DashboardStateController {
    private readonly boundValue = (event: Event): void => {
        const { kind, value } = (event as CustomEvent).detail;
        if (kind !== "groups" || !Array.isArray(value)) {
            return;
        }
        this.groups = value;
        this.selectedSource ||= defaultDashboardSource(this.groups);
        this.ensureDashboardSelection();
        this.renderDashboard();
    };

    protected startBoundSource(): void {
        this.addEventListener("dashboard:bound-value", this.boundValue);
        if (this.isExampleMode()) {
            this.renderDashboard();
            return;
        }
        if (this.hasAttribute("external")) {
            this.renderDashboard();
            return;
        }
        if (!this.querySelector("[data-dashboard-list-source]")) {
            const template = document.createElement("template");
            template.innerHTML = definitions as unknown as string;
            template.content
                .querySelector("[cms-source]")!
                .setAttribute("cms-source", `${route("/api/dashboards")} as dashboards`);
            this.append(template.content.cloneNode(true));
        }
    }

    protected disconnectBoundSource(): void {
        this.removeEventListener("dashboard:bound-value", this.boundValue);
        this.disconnectState();
    }

    protected renderDashboard(): void {
        if (!this.querySelector("[data-widgets]")) {
            const widgets = document.createElement("p9r-stack");
            widgets.setAttribute("slot", "widgets");
            widgets.setAttribute("gap", "md");
            widgets.setAttribute("trim", "");
            widgets.setAttribute("data-widgets", "");
            this.append(widgets);
        }

        if (this.isExampleMode()) {
            renderExampleShell(this.shadowRoot!, this.detailSelection?.row ?? null);
            return;
        }
        const group = this.activeGroup();
        const dashboard = this.activeDashboard();
        renderDashboardShell(
            this.shadowRoot!,
            group,
            dashboard,
            this.detailSelection,
            this.tabState,
            this.drafts,
            dashboard ? this.detailResource.current(dashboard.source, dashboard.id, this.detailSelection) : null,
            this.groups,
            this.dashboardFilters(),
        );
    }

    public setExternalContext(groups: DashboardSourceGroup[], selection: DashboardSelection): void {
        this.groups = structuredClone(groups);
        this.syncFromSelection(selection);
        this.ensureDashboardSelection();
        this.renderDashboard();
    }

    protected syncSelectionAndRender(selection: DashboardSelection): void {
        this.syncFromSelection(selection);
        this.ensureDashboardSelection();
        this.renderDashboard();
    }

    protected actionContext(): DashboardViewActionContext {
        return {
            group: this.activeGroup(),
            groups: this.groups,
            dashboard: this.activeDashboard(),
            detail: this.detailSelection,
            drafts: this.drafts,
            filters: this.dashboardFilters(),
            render: () => this.renderDashboard(),
            reloadDefinitions: () => this.reloadDefinitions(),
            reload: (collection, row) => this.reloadDetail(collection, row),
            reloadCollection: (widgetId) => reloadCollection(this, widgetId),
            clearDetail: () => this.clearDetail(),
            openDetail: (collection, row) => this.openDetail(collection, row),
            setDetailResource: (collection, row, resource) => this.setDetailResource(collection, row, resource),
            actionCoordinator: this.detailResource,
        };
    }

    private reloadDetail(collection: string, row: string): void {
        const dashboard = this.activeDashboard();
        if (!dashboard) {
            return;
        }
        if (this.detailResource.clearResource()) {
            this.renderDashboard();
            return;
        }
        document.dispatchEvent(new CustomEvent(detailReloadEvent(dashboard.source, dashboard.id, collection, row)));
    }
}
