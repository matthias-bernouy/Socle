import { NavigationOrder } from "./order/Order";
import { Component } from "@bernouy/components/base";
import { emitWidgetEvent, setText, WIDGET_ACTION_EVENT } from "../shared";
import "./WNavigationItem";
import type { DashboardWNavigationItem } from "./WNavigationItem";
import { navigationDragItem } from "./drag";
import css from "./style.css" with { type: "text" };
import template from "./template.html" with { type: "text" };

export class DashboardWNavigationList extends Component {
    static formAssociated = true;
    private readonly internals: ElementInternals;
    private order?: NavigationOrder;
    private readonly rowsObserver = new MutationObserver(() => this.syncItems());
    private dragging: DashboardWNavigationItem | null = null;

    constructor() {
        super({ css: css as unknown as string, template: template as unknown as string });
        this.internals = this.attachInternals();
    }

    get pendingOrder(): string[] | null {
        return this.order?.draft ?? null;
    }
    get value(): string[] {
        return (
            this.pendingOrder ??
            this.items()
                .map((item) => item.rowKey)
                .filter(Boolean)
        );
    }
    get form(): HTMLFormElement | null {
        return this.internals.form;
    }
    static observedAttributes = ["heading", "name"];
    attributeChangedCallback(): void {
        this.syncHeader();
        this.syncFormValue();
    }

    override connectedCallback(): void {
        const source = this.querySelector<HTMLElement>(":scope > [data-navigation-order-source]");
        if (source && this.form) {
            this.order = new NavigationOrder(this, this.form, source);
            this.order.connect();
        }
        this.rowsObserver.observe(this, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["row-key"],
        });
        this.shadowRoot!.querySelector<HTMLSlotElement>("slot")?.addEventListener("slotchange", this.onSlotChange);
        this.addEventListener("click", this.onActionClick);
        this.addEventListener("dragstart", this.onDragStart);
        this.addEventListener("dragover", this.onDragOver);
        this.addEventListener("drop", this.onDrop);
        this.addEventListener("dragend", this.onDragEnd);
        this.syncHeader();
        this.syncItems();
    }

    disconnectedCallback(): void {
        this.order?.disconnect();
        this.rowsObserver.disconnect();
        this.shadowRoot?.querySelector<HTMLSlotElement>("slot")?.removeEventListener("slotchange", this.onSlotChange);
        this.removeEventListener("click", this.onActionClick);
        this.removeEventListener("dragstart", this.onDragStart);
        this.removeEventListener("dragover", this.onDragOver);
        this.removeEventListener("drop", this.onDrop);
        this.removeEventListener("dragend", this.onDragEnd);
    }

    private syncHeader(): void {
        const heading = this.getAttribute("heading") ?? "";
        setText(this.shadowRoot!, "[data-title]", heading);
        this.query<HTMLElement>("[data-header]").hidden = !heading && !this.querySelector('[slot="actions"]');
    }

    private syncItems(): void {
        this.syncHeader();
        this.query<HTMLElement>("[data-empty]").hidden = this.items().length > 0;
        this.syncFormValue();
    }

    private onSlotChange = (): void => this.syncItems();

    private onActionClick = (event: Event): void => {
        const target = event
            .composedPath()
            .find((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-action"));
        if (!target?.dataset.action) {
            return;
        }
        if (target.dataset.confirm && !window.confirm(target.dataset.confirm)) {
            return;
        }
        emitWidgetEvent(this, WIDGET_ACTION_EVENT, {
            action: target.dataset.action,
            widget: target.dataset.widget,
            target: target.dataset.target,
        });
    };

    private onDragStart = (event: DragEvent): void => {
        const item = navigationDragItem(event);
        if (this.order?.busy) {
            event.preventDefault();
            return;
        }
        if (!item || !this.getAttribute("reorder-action")) {
            return;
        }
        this.dragging = item;
        item.toggleAttribute("data-dragging", true);
        event.dataTransfer?.setData("text/plain", item.rowKey);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
        }
    };

    private onDragOver = (event: DragEvent): void => {
        const item = navigationDragItem(event);
        if (!item || !this.dragging || item === this.dragging) {
            return;
        }
        event.preventDefault();
        this.items().forEach((candidate) => candidate.toggleAttribute("data-drop-target", candidate === item));
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
    };

    private onDrop = (event: DragEvent): void => {
        const target = navigationDragItem(event);
        const dragging = this.dragging;
        if (this.order?.busy || !target || !dragging || target === dragging || !this.getAttribute("reorder-action")) {
            return;
        }
        event.preventDefault();
        const movesDown = Boolean(dragging.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (this.order) {
            const ids = this.items().map((item) => item.rowKey);
            const from = ids.indexOf(dragging.rowKey);
            const to = ids.indexOf(target.rowKey);
            ids.splice(from, 1);
            ids.splice(to, 0, dragging.rowKey);
            this.clearDragState();
            this.order.submit(ids);
            this.syncFormValue();
            return;
        }
        if (movesDown) {
            target.parentNode!.insertBefore(dragging, target.nextSibling);
        } else {
            target.parentNode!.insertBefore(dragging, target);
        }
        const value = this.items()
            .map((item) => item.rowKey)
            .filter(Boolean);
        emitWidgetEvent(this, WIDGET_ACTION_EVENT, {
            action: this.getAttribute("reorder-action")!,
            widget: this.getAttribute("widget-id") ?? "",
            value,
        });
        this.clearDragState();
    };

    private onDragEnd = (): void => this.clearDragState();
    private clearDragState(): void {
        this.dragging = null;
        this.items().forEach((item) => {
            item.removeAttribute("data-dragging");
            item.removeAttribute("data-drop-target");
        });
    }
    private syncFormValue(): void {
        if (!this.internals) {
            return;
        }
        const name = this.getAttribute("name");
        if (!name) {
            this.internals.setFormValue(null);
            return;
        }
        const data = new FormData();
        for (const id of this.value) {
            data.append(`${name}[]`, id);
        }
        this.internals.setFormValue(data);
    }
    private items(): DashboardWNavigationItem[] {
        return Array.from(this.querySelectorAll<DashboardWNavigationItem>("cms-dashboard-w-navigation-item"));
    }
    private query<T extends Element>(selector: string): T {
        return this.shadowRoot!.querySelector(selector) as T;
    }
}

if (!customElements.get("cms-dashboard-w-navigation-list")) {
    customElements.define("cms-dashboard-w-navigation-list", DashboardWNavigationList);
}
