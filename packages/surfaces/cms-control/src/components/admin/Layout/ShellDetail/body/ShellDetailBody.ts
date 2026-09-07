import { Component } from "@bernouy/components/base";
import css from "./style.css" with { type: "text" };
import template from "./template.html" with { type: "text" };

let sequence = 0;

export class CmsShellDetailBody extends Component {
    private readonly tabs: HTMLElement;
    private readonly main: HTMLElement;
    private readonly aside: HTMLElement;
    private resize?: ResizeObserver;
    private content?: MutationObserver;
    private invalidPending = false;

    constructor() {
        super({ css: css as unknown as string, template: template as unknown as string });
        this.tabs = this.shadowRoot!.querySelector("p9r-tabs")!;
        this.main = this.shadowRoot!.querySelector(".shell-detail-main")!;
        this.aside = this.shadowRoot!.querySelector(".shell-detail-aside")!;
        const id = ++sequence;
        this.main.id = `detail-main-${id}`;
        this.aside.id = `detail-aside-${id}`;
        this.tabs.setAttribute("active", this.main.id);
    }

    override connectedCallback(): void {
        this.main.setAttribute("label", this.getAttribute("main-label") ?? "Details");
        this.aside.setAttribute("label", this.getAttribute("aside-label") ?? "Settings");
        if (!this.hasAttribute("tabbed")) {
            return;
        }
        this.resize = new ResizeObserver(this.sync);
        this.resize.observe(this);
        this.content = new MutationObserver(this.sync);
        this.content.observe(this, { childList: true, subtree: true });
        this.shadowRoot!.querySelector('slot[name="aside"]')!.addEventListener("slotchange", this.sync);
        this.addEventListener("invalid", this.onInvalid, true);
        this.sync();
    }

    disconnectedCallback(): void {
        this.resize?.disconnect();
        this.content?.disconnect();
        this.shadowRoot!.querySelector('slot[name="aside"]')!.removeEventListener("slotchange", this.sync);
        this.removeEventListener("invalid", this.onInvalid, true);
    }

    /** Reveal an existing control without moving it or changing its form association. */
    reveal(control: HTMLElement): void {
        if (!this.hasAttribute("tabbed") || !this.hasAttribute("compact")) {
            return;
        }
        const branch = control.closest('[slot="main"], [slot="aside"]');
        if (branch?.parentElement === this) {
            this.tabs.setAttribute("active", branch.getAttribute("slot") === "aside" ? this.aside.id : this.main.id);
        }
    }

    private readonly onInvalid = (event: Event): void => {
        if (this.invalidPending || !(event.target instanceof HTMLElement)) {
            return;
        }
        this.invalidPending = true;
        this.reveal(event.target);
        queueMicrotask(() => {
            this.invalidPending = false;
        });
    };

    private readonly sync = (): void => {
        const slot = this.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="aside"]')!;
        const hasAside = slot.assignedElements({ flatten: true }).some(hasContent);
        const compact = this.getBoundingClientRect().width <= 760;
        this.toggleAttribute("has-aside", hasAside);
        this.toggleAttribute("compact", compact);
        this.tabs.toggleAttribute("expanded", !this.hasAttribute("tabbed") || !compact || !hasAside);
    };
}

function hasContent(element: Element): boolean {
    if (element instanceof HTMLSlotElement) {
        return element.assignedElements({ flatten: true }).some(hasContent);
    }
    if (["P9R-STACK", "DIV"].includes(element.tagName)) {
        return element.children.length
            ? Array.from(element.children).some(hasContent)
            : Boolean(element.textContent?.trim());
    }
    return !element.hasAttribute("hidden");
}

if (!customElements.get("cms-shell-detail-body")) {
    customElements.define("cms-shell-detail-body", CmsShellDetailBody);
}
