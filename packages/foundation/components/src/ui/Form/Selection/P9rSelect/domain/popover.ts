import type { P9rSelectView } from "../P9rSelectView";
import type { SelectKeyboard } from "./keyboard";

export class SelectPopover {
    isOpen = false;

    constructor(
        private readonly view: P9rSelectView,
        private readonly keyboard: SelectKeyboard,
    ) {}

    connect(): void {
        this.view.panel?.addEventListener("beforetoggle", this.onBeforeToggle);
        this.view.panel?.addEventListener("toggle", this.onToggle);
    }

    disconnect(): void {
        this.view.panel?.removeEventListener("beforetoggle", this.onBeforeToggle);
        this.view.panel?.removeEventListener("toggle", this.onToggle);
        this.view.hide();
        this.unbindReposition();
    }

    open(): void {
        if (this.isOpen) {
            return;
        }
        this.view.show();
        this.isOpen = true;
        this.view.setOpen(true);
        this.keyboard.opened();
    }

    private readonly onBeforeToggle = (event: Event): void => {
        if ((event as ToggleEvent).newState === "open") {
            this.reposition();
        }
    };

    private readonly onToggle = (event: Event): void => {
        this.isOpen = (event as ToggleEvent).newState === "open";
        this.view.setOpen(this.isOpen);
        if (this.isOpen) {
            this.keyboard.opened();
            window.addEventListener("scroll", this.reposition, { capture: true, passive: true });
            window.addEventListener("resize", this.reposition);
        } else {
            this.keyboard.closed();
            this.unbindReposition();
        }
    };

    private unbindReposition(): void {
        window.removeEventListener("scroll", this.reposition, { capture: true });
        window.removeEventListener("resize", this.reposition);
    }

    private readonly reposition = (): void => {
        if (!this.view.trigger || !this.view.panel) {
            return;
        }
        const rect = this.view.trigger.getBoundingClientRect();
        const gap = 4;
        const height = document.documentElement.clientHeight || window.innerHeight;
        const width = document.documentElement.clientWidth || window.innerWidth;
        const below = height - rect.bottom - gap;
        const above = rect.top - gap;
        const opensUp = below < 120 && above > below;
        const panelWidth = Math.min(rect.width, Math.max(0, width - gap * 2 - 2));
        this.view.panel.style.top = opensUp ? "auto" : `${rect.bottom + gap}px`;
        this.view.panel.style.bottom = opensUp ? `${height - rect.top + gap}px` : "auto";
        this.view.panel.style.left = `${Math.max(gap, Math.min(rect.left, width - panelWidth - gap - 2))}px`;
        this.view.panel.style.width = `${panelWidth}px`;
        if (this.view.list) {
            // Leave room for the list padding and the panel border.
            this.view.list.style.maxHeight = `${Math.max(0, Math.min(200, (opensUp ? above : below) - 10))}px`;
        }
    };
}
