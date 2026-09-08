import { refreshSourceContext } from "@bernouy/components";
import { Component } from "@bernouy/components/base";
import { emitWidgetEvent, setText, WIDGET_ACTION_EVENT, WIDGET_FILTER_CHANGE_EVENT } from "../shared";
import type { DashboardWRow } from "./WRow";
import "./WRow";
import "./WCell";
import css from "./style.css" with { type: "text" };
import template from "./template.html" with { type: "text" };

/** Visual table shell and local selection/form interactions; data belongs to binding. */
export class DashboardWTable extends Component {
    private readonly rowsObserver = new MutationObserver(() => this.syncPresentation());
    constructor() {
        super({ css: css as unknown as string, template: template as unknown as string });
    }
    set selected(value: string) {
        this.setAttribute("data-selected", value);
    }
    static observedAttributes = ["heading", "subtitle", "data-selected"];
    attributeChangedCallback(): void {
        this.syncPresentation();
    }
    override connectedCallback(): void {
        this.rowsObserver.observe(this, { childList: true, subtree: true });
        this.shadowRoot!.querySelector("[data-select-all]")?.addEventListener("change", this.onSelectAll);
        this.addEventListener("click", this.onClick);
        this.addEventListener("cms-dashboard-row:check", this.onSelectionChange);
        this.addEventListener("submit", this.onFilterSubmit);
        this.syncPresentation();
    }
    disconnectedCallback(): void {
        this.rowsObserver.disconnect();
        this.shadowRoot?.querySelector("[data-select-all]")?.removeEventListener("change", this.onSelectAll);
        this.removeEventListener("click", this.onClick);
        this.removeEventListener("cms-dashboard-row:check", this.onSelectionChange);
        this.removeEventListener("submit", this.onFilterSubmit);
    }
    private syncPresentation(): void {
        setText(this.shadowRoot!, "[data-title]", this.getAttribute("heading") ?? "");
        setText(this.shadowRoot!, "[data-subtitle]", this.getAttribute("subtitle") ?? "");
        this.shadowRoot!.querySelector<HTMLElement>("[data-header]")!.hidden =
            !this.getAttribute("heading") && !this.getAttribute("subtitle") && !this.querySelector('[slot="actions"]');
        const rows = this.rows();
        for (const row of rows) {
            row.toggleAttribute("selected", Boolean(this.dataset.selected && row.rowKey === this.dataset.selected));
        }
        this.shadowRoot!.querySelector<HTMLElement>("[data-empty]")!.hidden = rows.length > 0;
    }
    private rows(): DashboardWRow[] {
        return Array.from(this.querySelectorAll<DashboardWRow>("cms-dashboard-w-row"));
    }
    private onClick = (event: Event): void => {
        const target = event
            .composedPath()
            .find(
                (node): node is HTMLElement =>
                    node instanceof HTMLElement &&
                    (node.hasAttribute("data-action") || node.hasAttribute("data-filter-clear")),
            );
        if (!target || target.closest("cms-dashboard-w-table") !== this) {
            return;
        }
        if (target.hasAttribute("data-filter-clear")) {
            for (const control of this.filterControls()) {
                control.value = "";
            }
            this.emitFilters({});
            return;
        }
        if (target.dataset.confirm && !window.confirm(target.dataset.confirm)) {
            return;
        }
        if (target.dataset.action) {
            emitWidgetEvent(this, WIDGET_ACTION_EVENT, {
                action: target.dataset.action,
                widget: target.dataset.widget,
                target: target.dataset.target,
            });
        }
    };
    get selectedKeys(): string[] {
        return this.rows()
            .filter((row) => row.checked)
            .map((row) => row.rowKey);
    }
    private onSelectionChange = (): void => {
        refreshSourceContext(this);
    };
    private onSelectAll = (event: Event): void => {
        const checked = Boolean((event.target as HTMLInputElement | null)?.checked);
        for (const row of this.rows()) {
            row.checked = checked;
        }
        this.onSelectionChange();
    };
    private onFilterSubmit = (event: Event): void => {
        if (!(event.target instanceof HTMLFormElement) || !event.target.hasAttribute("data-filters")) {
            return;
        }
        event.preventDefault();
        const values: Record<string, string> = {};
        for (const control of this.filterControls()) {
            const value = control.value.trim();
            if (value) {
                values[control.dataset.filterId!] = value;
            }
        }
        this.emitFilters(values);
    };
    private filterControls(): (HTMLInputElement | HTMLSelectElement)[] {
        return Array.from(this.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter-id]"));
    }
    private emitFilters(filters: Record<string, string>): void {
        emitWidgetEvent(this, WIDGET_FILTER_CHANGE_EVENT, { widget: this.dataset.widgetId ?? "", filters });
    }
}

if (!customElements.get("cms-dashboard-w-table")) {
    customElements.define("cms-dashboard-w-table", DashboardWTable);
}
