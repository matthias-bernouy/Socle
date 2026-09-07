import { MediaFormValue } from "./formValue";
import { Component } from "@bernouy/components/base";
import { refreshSourceContext } from "@bernouy/components";
import css from "../styles";
import slotCss from "./parts/field.css" with { type: "text" };
import template from "./parts/field.html" with { type: "text" };
import { MediaDragController } from "../controllers/drag";
import { dispatchMediaChange } from "../mediaState";
import type { DashboardMediaItem, DashboardMediaAction, DashboardMediaActionDetail } from "../types";
import { mediaFiles } from "./files";
import { MediaPreview } from "./Preview";

/** Visual shell and local file interactions. The page binding owns every media tile. */
export class DashboardMediaField extends Component {
    static formAssociated = true;
    static observedAttributes = ["label", "count"];
    private readonly formValue: MediaFormValue;
    get form(): HTMLFormElement | null {
        return this.formValue.internals.form;
    }
    get value(): Array<string | number> {
        return this.formValue.value;
    }
    readonly preview: MediaPreview;
    private pendingItems?: DashboardMediaItem[];
    private replaceIndex: number | undefined;
    private suppressClick = false;
    private readonly drag = new MediaDragController(
        () => this,
        (from, to) => this.move(from, to),
        (value) => {
            this.suppressClick = value;
        },
    );
    constructor() {
        super({ css: css + slotCss, template: template as unknown as string });
        this.formValue = new MediaFormValue(this, () => this.items);
        this.preview = new MediaPreview(this);
    }
    override connectedCallback(): void {
        this.fileInput.addEventListener("change", this.onFiles);
        this.addEventListener("click", this.onClick);
        for (const [name, handler] of this.dragEvents) {
            this.addEventListener(name, handler);
        }
        this.preview.connect();
        this.formValue.connect();
    }
    disconnectedCallback(): void {
        this.fileInput.removeEventListener("change", this.onFiles);
        this.removeEventListener("click", this.onClick);
        for (const [name, handler] of this.dragEvents) {
            this.removeEventListener(name, handler);
        }
        this.preview.disconnect();
        this.formValue.disconnect();
    }
    attributeChangedCallback(name: string): void {
        if (name === "label") {
            this.shadowRoot!.querySelector("[data-label]")!.textContent = this.getAttribute("label") ?? "";
        } else {
            this.preview.syncCount();
        }
    }
    get items(): DashboardMediaItem[] {
        if (this.pendingItems) {
            return this.pendingItems;
        }
        return Array.from(this.querySelectorAll<HTMLElement>("[data-media-tile]")).map((tile) => ({
            id: tile.dataset.mediaId ?? "",
            url: tile.dataset.mediaUrl ?? "",
            ...(tile.dataset.mediaAlt ? { alt: tile.dataset.mediaAlt } : {}),
            ...(tile.dataset.mediaName ? { name: tile.dataset.mediaName } : {}),
            ...(tile.dataset.mediaThumbnail ? { thumbnailUrl: tile.dataset.mediaThumbnail } : {}),
            ...(tile.hasAttribute("data-pending") ? { pending: true } : {}),
        }));
    }
    refresh(): void {
        if (this.isConnected) {
            refreshSourceContext(this.owner);
        }
    }
    private get owner(): HTMLElement {
        return this.closest<HTMLElement>("cms-dashboard-w-detail")!;
    }
    private get fileInput(): HTMLInputElement {
        return this.shadowRoot!.querySelector("[data-file]")!;
    }
    private get dragEvents(): Array<[string, EventListener]> {
        return [
            ["dragstart", this.drag.start],
            ["dragover", this.drag.over],
            ["drop", this.drag.drop],
            ["dragend", this.drag.end],
        ];
    }
    private readonly onClick = (event: Event): void => {
        const path = event.composedPath();
        const button = path.find(
            (node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-media-action"),
        );
        const tile = path.find(
            (node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-media-tile"),
        );
        const index = tile ? Number(tile.dataset.index) : undefined;
        if (button?.dataset.mediaAction === "remove" && index !== undefined) {
            const items = this.items;
            const item = items[index];
            if (item) {
                this.changed(
                    "remove",
                    items.filter((_, current) => current !== index),
                    { index, item },
                );
            }
        } else if (button?.dataset.mediaAction === "upload") {
            this.pick();
        } else if (tile && index !== undefined && !this.suppressClick) {
            this.pick(index);
        }
    };
    private pick(index?: number): void {
        this.replaceIndex = index;
        this.fileInput.value = "";
        this.fileInput.accept = this.getAttribute("accept") ?? "image/*";
        this.fileInput.multiple = index === undefined && this.hasAttribute("multiple");
        this.fileInput.click();
    }
    private readonly onFiles = (event: Event): void => {
        event.stopPropagation();
        const files = Array.from(this.fileInput.files ?? []);
        if (!files[0]) {
            return;
        }
        const items = this.items;
        if (this.replaceIndex !== undefined) {
            const index = this.replaceIndex;
            const previousItem = items[index];
            if (!previousItem) {
                return;
            }
            const item = { ...previousItem, ...mediaFiles(this.owner).create(files[0]), id: previousItem.id };
            this.changed(
                "replace",
                items.map((old, current) => (current === index ? item : old)),
                { index, previousItem, item, file: files[0] },
            );
        } else {
            const selected = this.hasAttribute("multiple") ? files : [files[0]];
            this.changed("upload", [...items, ...selected.map((file) => mediaFiles(this.owner).create(file))], {
                files: selected,
            });
        }
    };
    private move(from: number, to: number): void {
        const items = this.items;
        if (from === to || to < 0 || to >= items.length) {
            return;
        }
        const [item] = items.splice(from, 1);
        if (item) {
            items.splice(to, 0, item);
            this.changed("reorder", items, { from, to, item });
        }
    }
    private changed(
        action: DashboardMediaAction,
        items: DashboardMediaItem[],
        detail: Partial<DashboardMediaActionDetail>,
    ): void {
        const previousValue = this.items;
        this.pendingItems = items;
        try {
            dispatchMediaChange(this, action, items, { ...detail, previousValue });
        } finally {
            this.pendingItems = undefined;
        }
    }
}
customElements.define("cms-dashboard-media-field", DashboardMediaField);
