import { configureDetailPresentation } from "./presentation";
import { connectMediaForms } from "../../../runtime/actions/forms/views/media";
import { connectDetailForm } from "../../../runtime/actions/forms/views/detail";
import { readSourceData, refreshSourceContext } from "@bernouy/components";
import { Component } from "@bernouy/components/base";
import { bindDetailContext } from "../binding/context";
import { boundSchemas } from "../controls/schema/binding/data";
import type { DashboardLookup } from "../lookups/Lookup";
import { releaseMediaFiles } from "../../w-media-field/binding/files";
import { valueAt } from "../../../runtime/expressions";
import { detailData } from "../../../runtime/mapping";
import { DetailEvents } from "../runtime/events";
import { DetailFieldState, type DetailBinding, type DetailWidget } from "../runtime/fieldState";
import type { WDetailData, WDetailField, WDetailSection } from "../types";
import "../../w-section/WSection";
import "cms-control/components/admin/Layout/ShellDetail/ShellDetail";
import css from "./base.css" with { type: "text" };
import panelCss from "./panel.css" with { type: "text" };
import template from "./template.html" with { type: "text" };

/** Visual shell and local edit operations. The page binding owns response rendering. */
export class DashboardWDetail extends Component {
    private stopMedia?: () => void;
    private stopForm?: () => void;
    private configuration?: DetailWidget;
    private readonly fields: DetailFieldState;
    private readonly events: DetailEvents;

    constructor() {
        super({ css: css + panelCss, template: template as unknown as string });
        this.fields = new DetailFieldState(
            this.shadowRoot!,
            () => this.readBinding(),
            () => this.operationData(),
        );
        this.events = new DetailEvents(
            this,
            this.fields,
            () => this.operationData(),
            () => refreshSourceContext(this),
        );
    }

    configure(widget: DetailWidget): void {
        this.configuration = widget;
        this.setAttribute("data-declarative", "");
        bindDetailContext(
            this,
            widget,
            (resource) => this.fields.draftForResource(resource),
            () => this.fields.displayDraft,
        );
    }

    private readBinding(): DetailBinding | null {
        if (!this.configuration) {
            return null;
        }
        const data = readSourceData(this);
        const resource = this.configuration.source.itemPath ? valueAt(data, this.configuration.source.itemPath) : data;
        return resource == null
            ? null
            : {
                  widget: this.configuration,
                  resource,
                  rowKey: this.dataset.rowKey ?? "",
                  sourceId: this.dataset.sourceId ?? "",
              };
    }

    private operationData(): WDetailData {
        const binding = this.readBinding();
        return binding
            ? detailData(
                  binding.widget,
                  binding.resource,
                  binding.rowKey,
                  this.fields.draft,
                  {},
                  binding.sourceId,
                  boundSchemas(this),
              )
            : { rowKey: "", eyebrow: "", title: "", actions: [], main: [], aside: [] };
    }

    applyLookupCreate(fieldId: string, value: unknown, option: { value: string; label: string }): void {
        const control = this.fields.control(fieldId);
        const lookup = control?.closest<DashboardLookup>("cms-dashboard-lookup");
        if (lookup && this.fields.find(fieldId)) {
            const field = this.fields.find(fieldId)!;
            const current = control as HTMLElement & { values?: string[] };
            this.fields.record(
                fieldId,
                field.input === "tokens" ? [...new Set([...(current.values ?? []), String(value)])] : value,
            );
            lookup.acceptCreatedOption(option);
            refreshSourceContext(this);
        }
    }

    acknowledgeSavedFields(fields: Record<string, unknown>): void {
        this.fields.acknowledgeSavedFields(fields);
    }

    restoreField(field: string, submitted: unknown, previous: unknown): void {
        this.fields.restoreField(field, submitted, previous);
        refreshSourceContext(this);
    }

    applyFieldDraft(field: string, value: unknown): void {
        this.fields.record(field, value);
        refreshSourceContext(this);
    }

    hasUnsavedChanges(): boolean {
        return Object.keys(this.fields.draft).length > 0;
    }

    currentFieldValues(): Record<string, unknown> {
        return this.fields.currentFields();
    }

    static observedAttributes = ["data-row-key", "data-source-id"];

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.syncScope();
        }
    }

    override connectedCallback(): void {
        configureDetailPresentation(this);
        this.syncScope();
        this.stopMedia = connectMediaForms(this);
        this.events.bind();
        this.stopForm = connectDetailForm(
            this,
            () => this.fields.validate(),
            () => this.fields.draft,
            (snapshot) => this.fields.acknowledgeDraft(snapshot),
            this.configuration?.create && this.dataset.rowKey === "__new__" ? this.configuration.save : undefined,
        );
    }

    disconnectedCallback(): void {
        this.events.unbind();
        this.stopMedia?.();
        this.stopMedia = undefined;
        this.stopForm?.();
        this.stopForm = undefined;
        this.fields.clear();
        releaseMediaFiles(this);
    }

    private syncScope(): void {
        this.fields.syncScope(
            JSON.stringify([this.dataset.sourceId ?? "", this.configuration?.id, this.dataset.rowKey ?? ""]),
        );
    }
}

if (!customElements.get("cms-dashboard-w-detail")) {
    customElements.define("cms-dashboard-w-detail", DashboardWDetail);
}
export type { WDetailData, WDetailField, WDetailSection };
