import { ActionForms } from "../../runtime/actions/forms";
import { DashboardDefinitions } from "./definitions";
import { defaultDashboardSource, type DashboardSelection } from "../../api";
import { detailReloadEvent } from "../../runtime/reload";
import type { DashboardSourceGroup } from "../../types";
import type { DashboardViewActionContext } from "../actions";
import { renderDashboardShell, renderExampleShell } from "../rendering";
import { DashboardStateController } from "./DashboardStateController";
import type { DashboardWDetail } from "../../widgets/w-detail/WDetail";

export class DashboardViewController extends DashboardStateController {
    private readonly actionForms = new ActionForms(this);
    private readonly definitions = new DashboardDefinitions();

    protected startBoundSource(): void {
        if (this.isExampleMode() || this.hasAttribute("external")) {
            this.renderDashboard();
            return;
        }
        this.definitions.connect(this, (groups) => {
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
            this.ensureDashboardSelection();
            this.renderDashboard();
        });
    }

    protected disconnectBoundSource(): void {
        this.actionForms.disconnect();
        this.definitions.disconnect();
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
            submit: this.actionForms.submit,
            group: this.activeGroup(),
            groups: this.groups,
            dashboard: this.activeDashboard(),
            detail: this.detailSelection,
            drafts: this.drafts,
            filters: this.dashboardFilters(),
            reload: (collection, row) => this.reloadDetail(collection, row),
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
            openDetail: (collection, row) => this.openDetail(collection, row),
            navigateDetail: (collection, row) => {
                const detail = this.querySelector<DashboardWDetail>("cms-dashboard-w-detail");
                if (detail?.hasUnsavedChanges()) {
                    if (!window.confirm("Discard the unsaved changes?")) {
                        return;
                    }
                    if (this.detailSelection) {
                        this.drafts.delete(`${this.detailSelection.collection}:${this.detailSelection.row}`);
                    }
                }
                this.openDetail(collection, row);
            },
            actionCoordinator: this.actionScope,
        };
    }

    private reloadDetail(collection: string, row: string): void {
        const dashboard = this.activeDashboard();
        if (!dashboard) {
            return;
        }
        document.dispatchEvent(new CustomEvent(detailReloadEvent(dashboard.source, dashboard.id, collection, row)));
    }
}
