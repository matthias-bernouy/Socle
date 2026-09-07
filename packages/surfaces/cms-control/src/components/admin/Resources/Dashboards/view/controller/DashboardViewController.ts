import { DashboardDefinitions } from "./definitions";
import { defaultDashboardSource, type DashboardSelection } from "../../api";
import { detailReloadEvent, reloadCollection } from "../../runtime/reload";
import type { DashboardSourceGroup } from "../../types";
import type { DashboardViewActionContext } from "../actions";
import { renderDashboardShell, renderExampleShell } from "../rendering";
import { DashboardStateController } from "./DashboardStateController";
import type { DashboardWDetail } from "../../widgets/w-detail/WDetail";

export class DashboardViewController extends DashboardStateController {
    private readonly definitions = new DashboardDefinitions();

    protected startBoundSource(): void {
        if (this.isExampleMode() || this.hasAttribute("external")) {
            this.renderDashboard();
            return;
        }
        this.definitions.connect(this, (groups, render) => {
            this.groups = groups;
            const embeddedDashboard = this.getAttribute("dashboard-id");
            if (embeddedDashboard) {
                this.selectedSource =
                    groups.find((group) => group.dashboards.some((dashboard) => dashboard.id === embeddedDashboard))
                        ?.source.id ?? "";
                this.selectedDashboard = embeddedDashboard;
            } else {
                this.selectedSource ||= defaultDashboardSource(groups);
            }
            this.detailResource.clearResource();
            this.ensureDashboardSelection(render);
            if (render) {
                this.renderDashboard();
            }
        });
    }

    protected disconnectBoundSource(): void {
        this.definitions.disconnect();
        this.disconnectState();
    }

    protected async reloadDefinitions(): Promise<void> {
        if (this.hasAttribute("external")) {
            window.dispatchEvent(new CustomEvent("cms-dashboard-workspace:reload"));
            return;
        }
        await this.definitions.reload(this);
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
            acknowledgeDetailFields: (collection, row, fields) => {
                const target = Array.from(this.querySelectorAll<DashboardWDetail>("cms-dashboard-w-detail")).find(
                    (node) => node.dataset.widgetId === collection && (node.dataset.rowKey ?? "") === row,
                );
                target?.acknowledgeSavedFields(fields);
            },
            restoreDetailField: (collection, row, field, submitted, previous) => {
                const target = Array.from(this.querySelectorAll<DashboardWDetail>("cms-dashboard-w-detail")).find(
                    (node) => node.dataset.widgetId === collection && (node.dataset.rowKey ?? "") === row,
                );
                target?.restoreField(field, submitted, previous);
            },
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
