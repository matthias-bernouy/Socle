/** Reflect the native image lifecycle, including bound URL changes while a dialog is open. */
export class PreviewImageState {
    private readonly observer = new MutationObserver(() => this.refresh());
    private image: HTMLImageElement | null = null;
    private url = "";
    constructor(
        private readonly host: HTMLElement,
        private readonly status: HTMLElement,
    ) {}
    connect(): void {
        this.observer.observe(this.host, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src"],
        });
        this.host.addEventListener("load", this.onLoad, true);
        this.host.addEventListener("error", this.onError, true);
    }
    disconnect(): void {
        this.observer.disconnect();
        this.host.removeEventListener("load", this.onLoad, true);
        this.host.removeEventListener("error", this.onError, true);
    }
    refresh(): void {
        const image = this.host.querySelector<HTMLImageElement>("[data-preview-image]");
        const url = image?.getAttribute("src") ?? "";
        if (image === this.image && url === this.url) {
            return;
        }
        this.image = image;
        this.url = url;
        if (!image || !url) {
            return;
        }
        const ready = image.complete && image.naturalWidth > 0;
        image.dataset.state = ready ? "ready" : "loading";
        this.status.textContent = "Loading image…";
        this.status.hidden = ready;
    }
    private readonly onLoad = (event: Event): void => this.settled(event, false);
    private readonly onError = (event: Event): void => this.settled(event, true);
    private settled(event: Event, failed: boolean): void {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.hasAttribute("data-preview-image")) {
            return;
        }
        this.image = image;
        this.url = image.getAttribute("src") ?? "";
        image.dataset.state = failed ? "error" : "ready";
        this.status.hidden = !failed;
        if (failed) {
            this.status.textContent = "Unable to load this image.";
        }
    }
}
