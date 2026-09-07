import type { DashboardWidget } from "@bernouy/cms-dashboards";
import { valueAt } from "../../../runtime/expressions";
import { invalidFieldControl, readFieldControlValue, readFieldControlDraft } from "../controls";
import type { WDetailData, WDetailField } from "../types";
import { serializedTableRows } from "../controls/table/context";
import { remainingDraft } from "../../../domain/drafts";

export type DetailWidget = Extract<DashboardWidget, { widget: "w-detail" }>;

export type DetailBinding = {
    widget: DetailWidget;
    resource: unknown;
    rowKey: string;
    sourceId: string;
};

export class DetailFieldState {
    private scopeKey = "";
    private values: Record<string, unknown> = {};
    private displayValues: Record<string, string> = {};
    private submittedTables: Record<string, unknown> = {};
    private acknowledged: { fields: Record<string, unknown>; resource: unknown } | null = null;

    constructor(
        private readonly container: ShadowRoot,
        private readonly dataset: DetailBindingInput,
        private readonly readData: () => WDetailData,
    ) {}

    private get root(): ShadowRoot | Element {
        return this.container.host.hasAttribute("data-declarative") ? this.container.host : this.container;
    }

    get draft(): Record<string, unknown> {
        return this.values;
    }

    get displayDraft(): Record<string, string> {
        return this.displayValues;
    }

    acknowledgeSavedFields(fields: Record<string, unknown>): void {
        const accepted = { ...fields };
        for (const [id, draft] of Object.entries(this.submittedTables)) {
            if (
                Object.hasOwn(fields, id) &&
                JSON.stringify(serializedTableRows(draft)) === JSON.stringify(fields[id])
            ) {
                accepted[id] = draft;
                delete this.submittedTables[id];
            }
        }
        this.acknowledged = { fields: accepted, resource: this.currentResource() };
    }

    draftForResource(resource: unknown): Record<string, unknown> {
        if (this.acknowledged && !Object.is(this.acknowledged.resource, resource)) {
            this.values = remainingDraft(this.values, this.acknowledged.fields);
            this.displayValues = Object.fromEntries(
                Object.entries(this.displayValues).filter(([id]) => Object.hasOwn(this.values, id)),
            );
            this.acknowledged = null;
        }
        return this.values;
    }

    syncScope(scopeKey: string): void {
        if (this.scopeKey === scopeKey) {
            return;
        }
        this.scopeKey = scopeKey;
        this.values = {};
        this.displayValues = {};
        this.acknowledged = null;
        this.submittedTables = {};
    }

    clear(): void {
        this.scopeKey = "";
        this.values = {};
        this.displayValues = {};
        this.acknowledged = null;
        this.submittedTables = {};
    }

    record(fieldId: string, value: unknown, displayValue?: string): void {
        this.values[fieldId] = value;
        if (displayValue !== undefined) {
            this.displayValues[fieldId] = displayValue;
        } else {
            delete this.displayValues[fieldId];
        }
    }

    restoreField(fieldId: string, submitted: unknown, previous: unknown): void {
        if (
            !Object.hasOwn(this.values, fieldId) ||
            Object.hasOwn(remainingDraft(this.values, { [fieldId]: submitted }), fieldId)
        ) {
            return;
        }
        this.record(fieldId, structuredClone(previous));
    }

    find(fieldId: string): WDetailField | undefined {
        return this.fields().find((field) => field.id === fieldId);
    }

    fields(): WDetailField[] {
        const data = this.readData();
        return [...data.main, ...data.aside].flatMap((section) => section.fields);
    }

    currentResource(): unknown | undefined {
        return readDetailBinding(this.dataset)?.resource;
    }

    currentFields(): Record<string, unknown> {
        const fields: Record<string, unknown> = { ...this.values };
        const fieldsById = new Map(this.fields().map((field) => [field.id, field]));
        for (const control of Array.from(this.root.querySelectorAll<HTMLElement>("[data-field-control]"))) {
            const field = fieldsById.get(control.dataset.fieldControl ?? "");
            if (field) {
                fields[field.id] = readFieldControlValue(field, control);
            }
        }
        for (const id of this.editableTableIds()) {
            if (Object.hasOwn(fields, id)) {
                fields[id] = serializedTableRows(fields[id]);
            }
        }
        return fields;
    }

    submissionFields(): Record<string, unknown> {
        const submitted = this.currentFields();
        for (const id of this.editableTableIds()) {
            const field = this.find(id);
            const control = this.control(id);
            const draft =
                field && control?.localName === "cms-dashboard-table-field"
                    ? readFieldControlDraft(field, control)
                    : this.values[id];
            if (draft !== undefined) {
                this.record(id, draft);
                this.submittedTables[id] = structuredClone(draft);
            }
        }
        return submitted;
    }

    validate(): boolean {
        const values = this.currentFields();
        let invalid: HTMLElement | null = null;
        for (const field of this.fields()) {
            const control = this.control(field.id);
            if (!control) {
                continue;
            }
            this.syncRequiredValidity(field, control, values[field.id]);
            invalid ??= invalidFieldControl(field, control);
        }
        invalid ??= this.root.querySelector<HTMLElement>("[data-field-control][invalid]");
        invalid?.focus();
        return invalid === null;
    }

    refreshRequiredValidity(control: HTMLElement): void {
        const field = this.find(control.dataset.fieldControl ?? "");
        if (!field) {
            return;
        }
        this.syncRequiredValidity(field, control, readFieldControlValue(field, control));
    }

    control(fieldId: string): HTMLElement | null {
        return (
            Array.from(this.root.querySelectorAll<HTMLElement>("[data-field-control]")).find(
                (control) => control.dataset.fieldControl === fieldId,
            ) ?? null
        );
    }

    private editableTableIds(): string[] {
        const widget = readDetailBinding(this.dataset)?.widget;
        return [...(widget?.main ?? []), ...(widget?.aside ?? [])].flatMap((section) =>
            "widget" in section
                ? []
                : section.fields.filter((field) => field.type === "table" && field.editable).map((field) => field.id),
        );
    }

    private syncRequiredValidity(field: WDetailField, control: HTMLElement, value: unknown): void {
        if (!field.required) {
            clearRequiredError(control);
            return;
        }
        if (missingRequiredValue(value, field.input)) {
            control.dataset.dashboardRequiredInvalid = "true";
            control.setAttribute("invalid", "");
            control.setAttribute("aria-invalid", "true");
            control.setAttribute("hint", "This field is required.");
            control.setAttribute("hint-level", "error");
            return;
        }
        clearRequiredError(control);
    }
}

function missingRequiredValue(value: unknown, input: WDetailField["input"]): boolean {
    if (input === "checkbox") {
        return value !== true;
    }
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === "string") {
        return value.trim() === "";
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    return typeof value === "object" && Object.keys(value as Record<string, unknown>).length === 0;
}

function clearRequiredError(control: HTMLElement): void {
    if (control.dataset.dashboardRequiredInvalid !== "true") {
        return;
    }
    delete control.dataset.dashboardRequiredInvalid;
    control.removeAttribute("invalid");
    control.removeAttribute("aria-invalid");
    control.removeAttribute("hint");
    control.removeAttribute("hint-level");
}

export type DetailBindingInput = DOMStringMap | (() => DetailBinding | null);

export function readDetailBinding(dataset: DetailBindingInput): DetailBinding | null {
    if (typeof dataset === "function") {
        return dataset();
    }
    const widget = parseJson<DetailWidget>(dataset.configJson ?? "");
    const sourceJson = dataset.sourceJson ?? "";
    const sourceData = parseJson<unknown>(sourceJson);
    if (!widget || widget.widget !== "w-detail" || !sourceJson || sourceData === null) {
        return null;
    }
    const resource = widget.source.itemPath ? valueAt(sourceData, widget.source.itemPath) : sourceData;
    if (resource === undefined) {
        return null;
    }
    return {
        widget,
        resource,
        rowKey: dataset.rowKey ?? "",
        sourceId: dataset.sourceId ?? "",
    };
}

export function parseJson<T>(value: string): T | null {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}
