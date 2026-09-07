export function detailReloadEvent(sourceId: string, dashboardId: string, collection: string, row: string): string {
    return `cms-dashboard:${encodePart(sourceId)}:${encodePart(dashboardId)}:${encodePart(collection)}:${encodePart(row || "new")}:reload`;
}

function encodePart(value: string): string {
    return encodeURIComponent(value);
}
/** Refresh a retained collection through its existing binding source. */
export function reloadCollection(root: HTMLElement, widgetId: string): void {
    const widget = Array.from(root.querySelectorAll<HTMLElement>("[data-widget-id]")).find(
        (element) => element.dataset.widgetId === widgetId,
    );
    const source = widget?.matches("[cms-source][cms-reload-on]")
        ? widget
        : widget?.querySelector("[cms-source][cms-reload-on]");
    const event = source?.getAttribute("cms-reload-on");
    if (event) {
        root.ownerDocument.dispatchEvent(new Event(event));
    }
}

/** Delegate retries from the stable dashboard host, including cloned nested sources. */
export function retryDashboardSource(event: Event): void {
    const button = event
        .composedPath()
        .find(
            (node): node is HTMLElement =>
                node instanceof HTMLElement && node.hasAttribute("data-dashboard-source-retry"),
        );
    const source = button?.closest<HTMLElement>("[cms-source][cms-reload-on]");
    const name = source?.getAttribute("cms-reload-on");
    if (source && name) {
        source.ownerDocument.dispatchEvent(new Event(name));
    }
}
