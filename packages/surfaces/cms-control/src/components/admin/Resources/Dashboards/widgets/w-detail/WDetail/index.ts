import type { DashboardLookup } from "../lookups/Lookup";
import { boundSchemas } from "../controls/schema/binding/data";
import { releaseMediaFiles } from "../../w-media-field/binding/files";
import { readSourceData, setSourceData, refreshSourceContext } from "@bernouy/components";
import { bindDetailContext } from "../binding/context";
import { supportsBoundDetail } from "../binding/composition";
import { valueAt } from "../../../runtime/expressions";
import { Component } from "@bernouy/components/base";
import { fieldValues } from "../../../runtime/mapping";
import "../../w-section/WSection";
import "cms-control/components/admin/Layout/ShellDetail/ShellDetail";
import { applyLookupOption } from "../runtime/detailView";
import { readDetailBinding, type DetailWidget, type DetailBinding } from "../runtime/fieldState";
import schemaCss from "../runtime/schemas/style.css" with { type: "text" };
import type { WDetailData, WDetailField, WDetailSection } from "../types";
import baseCss from "./base.css" with { type: "text" };
import controlsCss from "./controls.css" with { type: "text" };
import { createDetailRuntime, DetailSyncScheduler, mapDetailData, type DetailRuntime } from "./runtime";
import template from "./template.html" with { type: "text" };

const styles = [baseCss, controlsCss, schemaCss].join("\n") as unknown as string;

export class DashboardWDetail extends Component {
    private configuration?: DetailWidget;
    private sourceUnavailable = false;
    private resource: unknown;
    configure(widget: DetailWidget): void {
        this.configuration = widget;
        if (!this.hasAttribute("data-declarative") && supportsBoundDetail(widget)) {
            this.setAttribute("data-declarative", "");
            bindDetailContext(
                this,
                widget,
                (resource) => this.runtime.fields.draftForResource(resource),
                () => this.runtime.fields.displayDraft,
            );
        }
    }
    setBindingValue(value: unknown): void {
        if (this.hasAttribute("data-declarative")) {
            setSourceData(this, value);
            return;
        }
        if (value === undefined || Object.is(value, this.resource)) {
            return;
        }
        this.resource = value;
        this.bindingRevision += 1;
        this.scheduleBoundDataSync();
    }
    private readBinding(): DetailBinding | null {
        if (!this.configuration) {
            return readDetailBinding(this.dataset);
        }
        const data = this.hasAttribute("data-declarative") ? readSourceData(this) : this.resource;
        const resource = this.configuration.source.itemPath ? valueAt(data, this.configuration.source.itemPath) : data;
        return resource === undefined || resource === null
            ? null
            : {
                  widget: this.configuration,
                  resource,
                  rowKey: this.dataset.rowKey ?? "",
                  sourceId: this.dataset.sourceId ?? "",
              };
    }
    private readonly boundValue = (event: Event): void => {
        const { kind, value } = (event as CustomEvent).detail;
        if (kind === "detail-status" && (event.target as Element).closest("cms-dashboard-w-detail") === this) {
            event.stopPropagation();
            this.sourceUnavailable = Boolean(value.loading || value.error);
            this.syncSourceAvailability();
        }
        if (kind === "detail" && (event.target as Element).closest("cms-dashboard-w-detail") === this) {
            event.stopPropagation();
            this.setBindingValue(value);
        }
    };
    private value: WDetailData = emptyDetailData();
    private readonly runtime: DetailRuntime;
    private readonly syncScheduler = new DetailSyncScheduler();
    private mode: "bound" | "manual" = "bound";
    private bindingRevision = 0;

    constructor() {
        super({ css: styles, template: template as unknown as string });
        this.runtime = createDetailRuntime(this, this.shadowRoot!, {
            readBinding: () => this.readBinding(),
            data: () => {
                const binding = this.hasAttribute("data-declarative") ? this.readBinding() : null;
                return binding
                    ? mapDetailData(
                          this.runtime,
                          binding.widget,
                          binding.resource,
                          binding.rowKey,
                          this.runtime.fields.draft,
                          binding.sourceId,
                          boundSchemas(this),
                      )
                    : this.value;
            },
            setData: (value) => {
                this.value = value;
            },
            render: () => this.render(),
            isConnected: () => this.isConnected,
            isBound: () => this.mode === "bound",
            refreshConditionalFields: () => this.refreshConditionalFields(),
        });
    }

    set data(value: WDetailData) {
        this.mode = "manual";
        this.syncScheduler.advanceLifecycle();
        this.clearRuntimeState();
        this.value = value;
        if (this.isConnected) {
            this.render();
        }
    }

    applyLookupCreate(fieldId: string, value: unknown, option: { value: string; label: string }): void {
        const control = this.runtime.fields.control(fieldId);
        const field = control ? this.runtime.fields.find(fieldId) : undefined;
        if (control && field) {
            const lookup = control.closest<DashboardLookup>("cms-dashboard-lookup");
            if (lookup) {
                this.runtime.fields.record(fieldId, value);
                lookup.acceptCreatedOption(option);
                refreshSourceContext(this);
                return;
            }
            applyLookupOption(control, value, option);
        }
    }

    acknowledgeSavedFields(fields: Record<string, unknown>): void {
        this.runtime.fields.acknowledgeSavedFields(fields);
    }

    restoreField(field: string, submitted: unknown, previous: unknown): void {
        this.runtime.fields.restoreField(field, submitted, previous);
        this.refreshConditionalFields();
    }

    static get observedAttributes(): string[] {
        return ["data-config-json", "data-source-json", "data-row-key", "data-source-id"];
    }

    attributeChangedCallback(): void {
        this.mode = "bound";
        this.bindingRevision += 1;
        this.scheduleBoundDataSync();
    }

    override connectedCallback(): void {
        this.syncScheduler.advanceLifecycle();
        this.runtime.events.bind();
        this.addEventListener("dashboard:bound-value", this.boundValue);
        if (this.mode === "manual") {
            this.render();
        } else {
            this.syncBoundData();
        }
    }

    disconnectedCallback(): void {
        releaseMediaFiles(this);
        this.syncScheduler.advanceLifecycle();
        this.runtime.events.unbind();
        this.removeEventListener("dashboard:bound-value", this.boundValue);
        this.resetState(true);
    }

    private render(): void {
        if (this.hasAttribute("data-declarative")) {
            return;
        }
        this.runtime.view.render(this.value);
        this.syncSourceAvailability();
    }

    private syncSourceAvailability(): void {
        for (const target of Array.from(
            this.shadowRoot!.querySelectorAll("[data-actions], [data-main], [data-aside]"),
        )) {
            target.toggleAttribute("inert", this.sourceUnavailable);
        }
    }

    private refreshConditionalFields(): void {
        if (this.hasAttribute("data-declarative")) {
            refreshSourceContext(this);
            return;
        }
        if (this.mode !== "bound") {
            return;
        }
        const binding = this.readBinding();
        if (!binding) {
            return;
        }
        const previous = this.value;
        const next = mapDetailData(
            this.runtime,
            binding.widget,
            binding.resource,
            this.value.rowKey,
            this.runtime.fields.currentFields(),
            this.dataset.sourceId ?? "",
        );
        this.value = next;
        this.runtime.view.refresh(previous, next);
    }

    private syncBoundData(): void {
        const binding = this.readBinding();
        if (!binding) {
            this.resetState();
            return;
        }
        const { widget, resource, rowKey, sourceId } = binding;
        const scopeKey = JSON.stringify([sourceId, widget.id, rowKey, this.bindingRevision]);
        this.runtime.requests.syncScope(scopeKey);
        this.runtime.fields.syncScope(scopeKey);
        this.runtime.lookups.syncScope(scopeKey);
        this.runtime.schemas.syncScope(scopeKey);
        this.value = mapDetailData(
            this.runtime,
            widget,
            resource,
            rowKey,
            this.runtime.fields.draft,
            this.dataset.sourceId ?? "",
        );
        if (this.isConnected) {
            this.render();
        }
        if (!sourceId || this.hasAttribute("data-declarative")) {
            return;
        }
        const fields = fieldValues(widget, resource);
        void this.runtime.lookups.load(widget, resource, rowKey, sourceId, fields, { useLatestFields: true });
        void this.runtime.schemas.load(widget, resource, rowKey, sourceId, fields, { useLatestFields: true });
    }

    private scheduleBoundDataSync(): void {
        this.syncScheduler.schedule(
            () => this.isConnected,
            () => this.mode === "bound",
            () => this.invalidateRequests(),
            () => this.syncBoundData(),
        );
    }

    private invalidateRequests(): void {
        this.runtime.lookups.clear();
        this.runtime.schemas.clear();
        this.runtime.requests.clear();
    }

    private clearRuntimeState(): void {
        this.invalidateRequests();
        this.runtime.fields.clear();
    }

    private resetState(forceRender = false): void {
        this.clearRuntimeState();
        this.value = emptyDetailData();
        if (forceRender || this.isConnected) {
            this.render();
        }
    }
}

if (!customElements.get("cms-dashboard-w-detail")) {
    customElements.define("cms-dashboard-w-detail", DashboardWDetail);
}

export type { WDetailData, WDetailField, WDetailSection };

function emptyDetailData(): WDetailData {
    return { rowKey: "", eyebrow: "", title: "", actions: [], main: [], aside: [] };
}
