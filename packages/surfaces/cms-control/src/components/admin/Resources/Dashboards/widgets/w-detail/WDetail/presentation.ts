/** Page and panel share their light-DOM controls; only their shell presentation differs. */
export function configureDetailPresentation(host: HTMLElement): void {
    const panel = host.getAttribute("presentation") === "modal";
    const root = host.shadowRoot!;
    root.querySelector("cms-shell-detail")!.toggleAttribute("contained", panel);
    root.querySelector("[data-actions]")!.setAttribute("slot", panel ? "footer" : "actions");
    if (!panel) {
        return;
    }
    for (const body of [
        ...Array.from(host.querySelectorAll("cms-shell-detail-body")),
        ...Array.from(root.querySelectorAll("cms-shell-detail-body")),
    ]) {
        if (body.getRootNode() === root || body.closest("cms-dashboard-w-detail") === host) {
            body.setAttribute("tabbed", "");
        }
    }
}
