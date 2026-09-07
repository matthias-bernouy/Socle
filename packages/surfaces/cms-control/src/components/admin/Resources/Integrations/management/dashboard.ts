import "../../Dashboards/view/DashboardView";

export async function settingsDashboard(id: string): Promise<HTMLElement> {
    const view = document.createElement("cms-dashboards-admin");
    view.setAttribute("embedded", "");
    view.setAttribute("dashboard-id", id);
    return view;
}
