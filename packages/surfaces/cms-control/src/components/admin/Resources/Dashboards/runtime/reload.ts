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
    const event = widget?.querySelector("[cms-source][cms-reload-on]")?.getAttribute("cms-reload-on");
    if (event) {
        root.ownerDocument.dispatchEvent(new Event(event));
    }
}
