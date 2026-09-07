import type { DashboardMediaItem } from "../types";

/** Native form participation for saved media references; preview data stays in the page. */
export class MediaFormValue {
    readonly internals: ElementInternals;
    private readonly observer = new MutationObserver(() => this.sync());

    constructor(
        private readonly host: HTMLElement,
        private readonly items: () => DashboardMediaItem[],
    ) {
        this.internals = host.attachInternals();
    }

    get value(): Array<string | number> {
        if (this.items().some((item) => item.pending)) {
            throw new Error("Wait for image uploads to finish before saving.");
        }
        return this.items().map((item) => {
            if (this.host.getAttribute("cms-form-value-type") !== "number") {
                return item.id;
            }
            const id = Number(item.id);
            if (!item.id || !Number.isFinite(id)) {
                throw new Error("The uploaded image has an invalid identifier.");
            }
            return id;
        });
    }

    connect(): void {
        this.observer.observe(this.host, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-pending", "data-media-id"],
        });
        this.sync();
    }

    disconnect(): void {
        this.observer.disconnect();
    }

    private sync(): void {
        if (!this.host.hasAttribute("persist-on-save")) {
            return;
        }
        const pending = this.items().some((item) => item.pending);
        this.host.toggleAttribute("invalid", pending);
        this.internals.setValidity(
            pending ? { customError: true } : {},
            pending ? "Wait for image uploads to finish before saving." : "",
        );
        const value = new FormData();
        if (!pending) {
            for (const item of this.items()) {
                value.append(this.host.getAttribute("name") ?? "", item.id);
            }
        }
        this.internals.setFormValue(value);
    }
}
