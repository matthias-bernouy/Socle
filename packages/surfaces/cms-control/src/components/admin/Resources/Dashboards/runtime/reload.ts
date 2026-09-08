export function detailReloadEvent(sourceId: string, dashboardId: string, collection: string, row: string): string {
    return `cms-dashboard:${encodePart(sourceId)}:${encodePart(dashboardId)}:${encodePart(collection)}:${encodePart(row || "new")}:reload`;
}

function encodePart(value: string): string {
    return encodeURIComponent(value);
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
