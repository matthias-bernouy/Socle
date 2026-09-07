import { DETAIL_SAVED_EVENT, type DetailSaved } from "../runtime/actions/forms/views/detail";
import { retryDashboardSource } from "../runtime/reload";
import { showToast } from "@bernouy/components";
import { currentSelection, DASHBOARD_SELECTION_EVENT, pushSelectionUrl, type DashboardSelection } from "../api";
import { detailKey } from "../domain";
import { updateDashboardWidgetExampleField } from "../widgets/example";
import {
    WIDGET_ACTION_EVENT,
    WIDGET_BACK_EVENT,
    WIDGET_FIELD_CHANGE_EVENT,
    WIDGET_FILTER_CHANGE_EVENT,
    WIDGET_MEDIA_ACTION_EVENT,
    WIDGET_ROW_SELECT_EVENT,
    type WidgetActionDetail,
    type WidgetFieldChangeDetail,
    type WidgetFilterChangeDetail,
    type WidgetMediaActionDetail,
    type WidgetRowSelectDetail,
} from "../widgets/shared";
import { runDashboardMediaAction, runDashboardWidgetAction } from "./actions";
import { DashboardViewController } from "./controller/DashboardViewController";
import baseCss from "./styles/base.css" with { type: "text" };
import panelsCss from "./styles/panels.css" with { type: "text" };
import template from "./template.html" with { type: "text" };

const styles = [baseCss, panelsCss].join("\n") as unknown as string;

export class DashboardView extends DashboardViewController {
    constructor() {
        super(styles, template as unknown as string);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (!this.hasAttribute("embedded")) {
            this.syncFromSelection(currentSelection());
        }
        this.addEventListener("click", this.onClick);
        this.addEventListener(DETAIL_SAVED_EVENT, this.onDetailSaved);
        this.addEventListener(WIDGET_ROW_SELECT_EVENT, this.onWidgetRowSelect as EventListener);
        this.addEventListener(WIDGET_BACK_EVENT, this.onWidgetBack);
        this.addEventListener(WIDGET_ACTION_EVENT, this.onWidgetAction as EventListener);
        this.addEventListener(WIDGET_FILTER_CHANGE_EVENT, this.onWidgetFilterChange as EventListener);
        this.addEventListener(WIDGET_FIELD_CHANGE_EVENT, this.onWidgetFieldChange as EventListener);
        this.addEventListener(WIDGET_MEDIA_ACTION_EVENT, this.onWidgetMediaAction as EventListener);
        window.addEventListener("popstate", this.onPopState);
        window.addEventListener(DASHBOARD_SELECTION_EVENT, this.onSelection as EventListener);
        this.startBoundSource();
    }

    disconnectedCallback(): void {
        this.removeEventListener("click", this.onClick);
        this.removeEventListener(DETAIL_SAVED_EVENT, this.onDetailSaved);
        this.removeEventListener(WIDGET_ROW_SELECT_EVENT, this.onWidgetRowSelect as EventListener);
        this.removeEventListener(WIDGET_BACK_EVENT, this.onWidgetBack);
        this.removeEventListener(WIDGET_ACTION_EVENT, this.onWidgetAction as EventListener);
        this.removeEventListener(WIDGET_FILTER_CHANGE_EVENT, this.onWidgetFilterChange as EventListener);
        this.removeEventListener(WIDGET_FIELD_CHANGE_EVENT, this.onWidgetFieldChange as EventListener);
        this.removeEventListener(WIDGET_MEDIA_ACTION_EVENT, this.onWidgetMediaAction as EventListener);
        window.removeEventListener("popstate", this.onPopState);
        window.removeEventListener(DASHBOARD_SELECTION_EVENT, this.onSelection as EventListener);
        this.disconnectBoundSource();
    }

    private onClick = (event: Event): void => {
        retryDashboardSource(event);
        const tabButton = (event.target as Element | null)?.closest<HTMLElement>("[data-tab-key]");
        if (!tabButton?.dataset.tabKey || !tabButton.dataset.tabIndex) {
            return;
        }
        this.tabState.set(tabButton.dataset.tabKey, Number(tabButton.dataset.tabIndex));
        this.renderDashboard();
    };

    private onSelection = (event: CustomEvent<DashboardSelection>): void => {
        if (!this.hasAttribute("embedded")) {
            this.syncSelectionAndRender(event.detail);
        }
    };
    private onPopState = (): void => {
        if (!this.hasAttribute("embedded")) {
            this.syncSelectionAndRender(currentSelection());
        }
    };

    private onDetailSaved = (event: Event): void => {
        const detail = event.target as HTMLElement;
        const saved = (event as CustomEvent<DetailSaved>).detail;
        if (
            !saved?.created ||
            !saved.id ||
            !this.detailSelection ||
            this.detailSelection.collection !== detail.dataset.widgetId
        ) {
            return;
        }
        this.openDetail(this.detailSelection.collection, saved.id);
    };

    private onWidgetRowSelect = (event: CustomEvent<WidgetRowSelectDetail>): void => {
        if (event.detail.source) {
            this.selectedSource = event.detail.source;
        }
        if (event.detail.dashboard) {
            this.selectedDashboard = event.detail.dashboard;
        }
        this.invalidateDetailResource();
        this.detailSelection = { collection: event.detail.collection, row: event.detail.rowKey };
        if (!this.isExampleMode() && !this.hasAttribute("embedded")) {
            pushSelectionUrl(this.selection());
        }
        this.renderDashboard();
    };

    private onWidgetBack = (): void => {
        this.invalidateDetailResource();
        this.clearDetail();
    };

    private onWidgetAction = (event: CustomEvent<WidgetActionDetail>): void => {
        if (this.isExampleMode()) {
            showToast(`${event.detail.action} clicked`, { type: "success" });
            return;
        }
        if (event.detail.target) {
            this.invalidateDetailResource();
            this.detailSelection = { collection: event.detail.target, row: "__new__" };
            pushSelectionUrl(this.selection());
            this.renderDashboard();
            return;
        }
        void runDashboardWidgetAction(this.actionContext(), event.detail);
    };

    private onWidgetMediaAction = (event: CustomEvent<WidgetMediaActionDetail>): void => {
        if (this.isExampleMode()) {
            showToast(`Media ${event.detail.action} event captured`, { type: "success" });
            return;
        }
        void runDashboardMediaAction(
            this.actionContext(),
            event.detail,
            event.target instanceof HTMLElement ? event.target : undefined,
        );
    };

    private onWidgetFilterChange = (event: CustomEvent<WidgetFilterChangeDetail>): void => {
        if (this.isExampleMode()) {
            showToast("Filters applied", { type: "success" });
            return;
        }
        this.setDashboardFilters(event.detail.widget, event.detail.filters);
        this.renderDashboard();
    };

    private onWidgetFieldChange = (event: CustomEvent<WidgetFieldChangeDetail>): void => {
        if (this.isExampleMode()) {
            updateDashboardWidgetExampleField(event.detail.rowKey, event.detail.field, event.detail.value);
            return;
        }
        if (!this.detailSelection) {
            return;
        }
        const key = detailKey(this.detailSelection.collection, event.detail.rowKey);
        const previousDraft = this.drafts.get(key) ?? {};
        this.drafts.set(key, { ...previousDraft, [event.detail.field]: event.detail.value });
    };
}

if (!customElements.get("cms-dashboards-admin")) {
    customElements.define("cms-dashboards-admin", DashboardView);
}
