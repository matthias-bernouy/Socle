import { readSourceData, setSourceData } from "@bernouy/components";
import type { DashboardWDetail } from "../../Dashboards/widgets/w-detail/WDetail";
import type { IntegrationManagement, IntegrationSettingsResponse } from "@bernouy/cms-integrations";
import { getIntegrationInstallation } from "../api";
import type { IntegrationInstallationDetail } from "../model";
import { managementRequest, readHealth } from "./api";
import { renderCollectionSettings } from "./collections";
import { renderHealth } from "./presentation/health";
import { settingsDashboard } from "./dashboard";
import { mountSettings } from "./settings";
import { renderManagementShell } from "./presentation/shell";
import { managementFeedback } from "./feedback";

export class IntegrationManagementView extends HTMLElement {
    private installation?: IntegrationInstallationDetail;
    private management?: IntegrationManagement;
    private busy = false;
    private revision = 0;
    private feedback?: ReturnType<typeof managementFeedback>;
    private panel = new URL(window.location.href).searchParams.get("panel") === "health" ? "health" : "connection";
    connectedCallback(): void {
        this.feedback = managementFeedback(this, this.getAttribute("installation-id") ?? "", (message) => {
            const status = this.querySelector("[data-management-status]");
            if (status) {
                status.textContent = message;
            }
        });
        void this.load();
    }
    disconnectedCallback(): void {
        this.revision += 1;
        this.feedback?.disconnect();
    }
    private async load(): Promise<void> {
        const revision = ++this.revision;
        const id = this.getAttribute("installation-id");
        if (!id) {
            return;
        }
        this.textContent = "Loading settings…";
        try {
            const installation = await getIntegrationInstallation(id);
            if (!this.isConnected || revision !== this.revision) {
                return;
            }
            this.installation = installation;
            this.management = installation.definition?.management;
            this.render();
            await this.showPanel();
        } catch (error) {
            if (revision === this.revision) {
                this.textContent = error instanceof Error ? error.message : "Unable to load settings.";
            }
        }
    }
    private render(): void {
        const configurationLabel =
            this.installation?.integrationType === "collection"
                ? "Availability"
                : this.management?.settings?.dashboardId
                  ? "Settings"
                  : "Connection";
        renderManagementShell(this, this.installation?.status ?? "unknown", configurationLabel, this.panel, (panel) => {
            if (!this.busy) {
                this.panel = panel;
                this.render();
                void this.showPanel();
            }
        });
        this.feedback?.refresh();
    }
    private async showPanel(refresh = false): Promise<void> {
        const revision = ++this.revision;
        const root = this.querySelector<HTMLElement>("[data-management-content]")!;
        const installation = this.installation!;
        root.textContent = "Loading…";
        try {
            if (this.panel === "health") {
                const health = await readHealth(installation.id, refresh);
                if (revision !== this.revision || !this.isConnected) {
                    return;
                }
                renderHealth(root, health, this.management ?? { schemaVersion: 1 }, (id) => void this.runAction(id));
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = "Refresh health";
                button.addEventListener("click", () => void this.showPanel(true));
                root.prepend(button);
            } else if (installation.integrationType === "collection") {
                renderCollectionSettings(root, installation, (message) => this.status(message));
            } else if (this.management?.settings?.dashboardId) {
                const dashboard = await settingsDashboard(this.management.settings.dashboardId);
                if (revision !== this.revision || !this.isConnected) {
                    return;
                }
                root.replaceChildren(dashboard);
            } else if (this.management?.settings) {
                mountSettings(
                    root,
                    this.management.settings.fields,
                    installation.id,
                    (editor, values, submitted) => void this.save(editor, values, submitted),
                    this.management.settings.applyFunctionId ? () => void this.runAction("apply-settings") : undefined,
                );
            } else {
                root.textContent = "This source has no connection settings.";
            }
        } catch (error) {
            if (revision === this.revision) {
                root.textContent = error instanceof Error ? error.message : "Unable to load this panel.";
            }
        }
    }
    private async save(
        editor: DashboardWDetail,
        values: Record<string, unknown>,
        submitted: Record<string, unknown>,
    ): Promise<void> {
        const settings = readSourceData(editor) as IntegrationSettingsResponse | undefined;
        if (this.busy || !settings) {
            return;
        }
        this.setBusy(true);
        this.status("Saving settings…");
        try {
            // Nested field paths, opaque metadata and revision checks require this typed operation.
            const saved = await managementRequest<IntegrationSettingsResponse>(this.installation!.id, "settings", {
                values,
                expectedRevision: settings.savedRevision,
            });
            if (this.isConnected && editor.isConnected && this.contains(editor)) {
                editor.acknowledgeSavedFields(submitted);
                setSourceData(editor, saved);
                this.status("Settings saved.");
            }
        } catch (error) {
            if (this.isConnected && this.contains(editor)) {
                this.status(error instanceof Error ? error.message : "Unable to save settings.");
            }
        } finally {
            this.setBusy(false);
        }
    }
    private async runAction(actionId: string): Promise<void> {
        if (this.busy) {
            return;
        }
        this.setBusy(true);
        this.status("Applying configuration…");
        try {
            await managementRequest(this.installation!.id, "action", { actionId, input: {} });
            if (!this.isConnected) {
                return;
            }
            this.status("Action completed.");
            const reload =
                this.panel === "connection"
                    ? this.querySelector("cms-dashboard-w-detail")?.getAttribute("cms-reload-on")
                    : undefined;
            if (reload) {
                this.ownerDocument.dispatchEvent(new Event(reload));
            } else {
                await this.showPanel(true);
            }
        } catch (error) {
            this.status(error instanceof Error ? error.message : "Action failed.");
        } finally {
            this.setBusy(false);
        }
    }
    private setBusy(busy: boolean): void {
        this.busy = busy;
        for (const action of Array.from(
            this.querySelectorAll<HTMLElement>("[data-action], [data-management-action]"),
        )) {
            action.toggleAttribute("disabled", busy);
        }
        this.toggleAttribute("aria-busy", busy);
    }
    private status(message: string): void {
        this.feedback?.set(message);
    }
}
if (!customElements.get("cms-integration-management")) {
    customElements.define("cms-integration-management", IntegrationManagementView);
}
