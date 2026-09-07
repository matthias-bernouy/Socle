import type { DashboardMediaField } from "./MediaField";
import { PreviewImageState } from "./ImageState";

/** Dialog, keyboard and image-loading interactions; binding renders media data. */
export class MediaPreview {
    index = 0;
    opened = false;
    private restoreFocus: HTMLElement | null = null;
    private readonly dialog: HTMLDialogElement;
    private readonly images: PreviewImageState;
    constructor(private readonly host: DashboardMediaField) {
        this.dialog = this.query("[data-preview-dialog]");
        this.images = new PreviewImageState(host, this.query("[data-preview-status]"));
    }
    connect(): void {
        this.host.addEventListener("click", this.onClick);
        this.dialog.addEventListener("keydown", this.onKeyDown);
        this.dialog.addEventListener("close", this.onClose);
        this.images.connect();
        this.syncCount();
    }
    disconnect(): void {
        this.host.removeEventListener("click", this.onClick);
        this.dialog.removeEventListener("keydown", this.onKeyDown);
        this.dialog.removeEventListener("close", this.onClose);
        this.images.disconnect();
        if (this.dialog.open) {
            this.dialog.close();
        }
    }
    syncCount(): void {
        const count = Number(this.host.getAttribute("count")) || 0;
        this.query<HTMLButtonElement>("[data-preview-open]").hidden = count === 0;
        for (const selector of [
            "[data-preview-action='previous']",
            "[data-preview-action='next']",
            "[data-preview-strip]",
        ]) {
            this.query<HTMLElement>(selector).hidden = count < 2;
        }
        if (this.opened && count === 0) {
            this.dialog.close();
        }
        this.index = Math.min(this.index, Math.max(0, count - 1));
    }
    private readonly onClick = (event: Event): void => {
        const path = event.composedPath();
        const target = path.find(
            (node): node is HTMLElement =>
                node instanceof HTMLElement &&
                node.matches("[data-preview-open], [data-preview-action], [data-preview-index]"),
        );
        if (target?.hasAttribute("data-preview-open")) {
            if (this.opened || this.host.items.length === 0) {
                return;
            }
            this.restoreFocus = target;
            this.index = 0;
            this.opened = true;
            this.changeImage();
            this.dialog.showModal();
            this.query<HTMLButtonElement>("[data-preview-action='close']").focus();
        } else if (target?.hasAttribute("data-preview-index")) {
            this.setIndex(Number(target.dataset.previewIndex), true);
        } else if (target?.dataset.previewAction === "close" || path[0] === this.dialog) {
            this.dialog.close();
        } else if (target?.dataset.previewAction === "previous") {
            this.move(-1);
        } else if (target?.dataset.previewAction === "next") {
            this.move(1);
        }
    };
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const focusThumbnail = Array.from(this.host.querySelectorAll("cms-dashboard-media-thumbnail")).some((node) =>
            Boolean(node.shadowRoot?.activeElement),
        );
        if (event.key === "Escape") {
            event.preventDefault();
            this.dialog.close();
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            this.move(-1, focusThumbnail);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            this.move(1, focusThumbnail);
        } else if (event.key === "Home") {
            event.preventDefault();
            this.setIndex(0, focusThumbnail);
        } else if (event.key === "End") {
            event.preventDefault();
            this.setIndex(this.host.items.length - 1, focusThumbnail);
        }
    };
    private readonly onClose = (): void => {
        this.opened = false;
        this.host.refresh();
        this.query<HTMLElement>("[data-preview-status]").hidden = true;
        this.restoreFocus?.focus();
        this.restoreFocus = null;
    };
    private move(offset: number, focus = false): void {
        const count = this.host.items.length;
        if (count > 1) {
            this.setIndex((this.index + offset + count) % count, focus);
        }
    }
    private setIndex(index: number, focus: boolean): void {
        if (!Number.isInteger(index) || index < 0 || index >= this.host.items.length) {
            return;
        }
        if (this.index !== index) {
            this.index = index;
            this.changeImage();
        }
        const thumbnail = this.host.querySelector<HTMLElement>(`cms-dashboard-media-thumbnail[index="${index}"]`);
        thumbnail?.scrollIntoView({ block: "nearest", inline: "center" });
        if (focus) {
            thumbnail?.focus();
        }
    }
    private changeImage(): void {
        const status = this.query<HTMLElement>("[data-preview-status]");
        status.textContent = "Loading image…";
        status.hidden = false;
        this.host.refresh();
        this.images.refresh();
    }
    private query<T extends Element>(selector: string): T {
        return this.host.shadowRoot!.querySelector(selector) as T;
    }
}
