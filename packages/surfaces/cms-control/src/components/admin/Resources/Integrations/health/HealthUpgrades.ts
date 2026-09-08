import { readSourceData, refreshSourceContext, setSourceContext, setSourceData } from "@bernouy/components";
import { integrationUpgradeVersions, upgradeIntegrationInstallation } from "../api";
import type { IntegrationInstallationRow } from "../model";
import { integrationUpgradeErrorMessage } from "../ui/actions/installation";
import markup from "cms-control/static/admin/_operations/health/upgrades.html" with { type: "text" };

type Candidate = { id: string; label: string; current: string; target: string; message: string; done: boolean };

/** Coordinates a reviewed sequential batch using the existing installation transport. */
class HealthUpgrades extends HTMLElement {
    private candidates: Candidate[] = [];
    private busy = false;
    private message = "";
    private page?: HTMLElement;
    connectedCallback(): void {
        const template = document.createElement("template");
        template.innerHTML = markup as unknown as string;
        this.replaceChildren(template.content.cloneNode(true));
        setSourceContext(this, () => ({
            upgradeItems: this.candidates,
            upgradeMessage: this.message,
            upgradeBusy: this.busy,
            upgradeAvailable: this.candidates.some((item) => item.target && !item.done),
        }));
        this.setAttribute("cms-source", "");
        setSourceData(this, {});
        this.page = this.closest("cms-health-page")!;
        this.page.addEventListener("click", this.onClick);
    }
    disconnectedCallback(): void {
        this.page?.removeEventListener("click", this.onClick);
    }
    private update(): void {
        refreshSourceContext(this);
        this.querySelector("[data-health-upgrade-confirm]")?.toggleAttribute(
            "disabled",
            this.busy || !this.candidates.some((item) => item.target && !item.done),
        );
    }
    private onClick = (event: Event): void => {
        const target = (event.target as Element).closest(
            "[data-health-check-upgrades], [data-health-upgrade-all], [data-health-upgrade-confirm]",
        );
        if (!target || this.busy) {
            return;
        }
        if (target.hasAttribute("data-health-upgrade-confirm")) {
            void this.apply();
        } else {
            void this.check();
        }
    };
    private async check(): Promise<void> {
        const rows = readSourceData(this.page!) as IntegrationInstallationRow[] | undefined;
        this.candidates = (rows ?? []).map((row) => ({
            id: row.id,
            label: row.label,
            current: row.definitionVersion,
            target: "",
            message: "Checking…",
            done: false,
        }));
        this.busy = true;
        this.message = "Checking available releases…";
        this.querySelector("p9r-modal")!.setAttribute("open", "");
        this.update();
        // Bound concurrency avoids flooding the integration repository.
        const pending = [...this.candidates];
        await Promise.all(
            Array.from({ length: 3 }, async () => {
                while (pending.length) {
                    const item = pending.shift()!;
                    try {
                        const choices = await integrationUpgradeVersions(item.id);
                        const preferred = choices.stable ?? choices.latest;
                        const target =
                            preferred && choices.versions.includes(preferred) ? preferred : choices.versions[0];
                        const evidence = choices.targets?.find((entry) => entry.version === target);
                        item.target =
                            target && target !== choices.current && evidence?.eligible !== false ? target : "";
                        item.message = item.target ? `${choices.current} → ${item.target}` : "No eligible upgrade";
                        const reasons =
                            choices.targets?.filter((entry) => !entry.eligible).flatMap((entry) => entry.reasons) ?? [];
                        const migrations =
                            evidence?.migrations.map(
                                (entry) =>
                                    `${entry.connectorKey}: rollback ${entry.rollback} (${entry.rollbackVerified ? "verified" : "not verified"}), point of no return ${entry.pointOfNoReturn}`,
                            ) ?? [];
                        item.message += [...migrations, ...reasons].length
                            ? ` · ${[...migrations, ...reasons].join("; ")}`
                            : "";
                    } catch (error) {
                        item.message = integrationUpgradeErrorMessage(error);
                    }
                    this.update();
                }
            }),
        );
        this.busy = false;
        const count = this.candidates.filter((item) => item.target).length;
        this.message = count
            ? `${count} upgrades available. Review the exact versions below before confirming. Upgrades run one at a time and stop if one fails.`
            : "No eligible upgrades found. Review any unavailable repositories below.";
        this.update();
    }
    private async apply(): Promise<void> {
        if (!this.candidates.some((item) => item.target && !item.done)) {
            return;
        }
        this.busy = true;
        this.message = "Applying the reviewed upgrades…";
        this.update();
        for (const item of this.candidates.filter((entry) => entry.target && !entry.done)) {
            try {
                item.message = `Upgrading to ${item.target}…`;
                this.update();
                await upgradeIntegrationInstallation(item.id, item.target);
                item.done = true;
                item.message = `Upgraded to ${item.target}`;
            } catch (error) {
                item.message = integrationUpgradeErrorMessage(error);
                this.message =
                    "Stopped after an upgrade failed. Completed upgrades remain applied. Check releases again before retrying.";
                item.target = "";
                for (const remaining of this.candidates) {
                    if (!remaining.done) {
                        remaining.target = "";
                    }
                }
                this.busy = false;
                this.update();
                return;
            }
        }
        this.busy = false;
        this.message = "The reviewed upgrades are complete.";
        this.ownerDocument.dispatchEvent(new Event("health:installations"));
        this.update();
    }
}
customElements.define("cms-health-upgrades", HealthUpgrades);
