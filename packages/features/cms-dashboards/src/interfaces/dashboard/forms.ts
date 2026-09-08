import type { DashboardRequestTarget } from "./refs";
import type { DashboardField } from "./fields";

export type DashboardFormHiddenField = {
    name: string;
    value: string | number | boolean;
    type: "string" | "number" | "boolean";
    empty?: "omit";
};

/** A real form contributes editable controls and scalar technical fields. */
export type DashboardFormOperation = DashboardRequestTarget & {
    sourceId?: string;
    label?: string;
    icon?: string;
    tone?: "primary" | "secondary" | "danger";
    confirm?: string;
    hiddenFields?: DashboardFormHiddenField[];
    valuesPath?: string;
    refresh?: "read" | "none";
};

export type DashboardSaveOperation = DashboardFormOperation & { refresh?: "read"; idPath?: string };

export type DashboardActionForm = DashboardFormOperation & { fields?: DashboardActionField[] };
export type DashboardDeleteOperation = DashboardFormOperation & { confirm: string };

/** Open the same detail definition for creation, editing, or selection. */
export type DashboardDetailOpenRef = {
    dashboardId?: string;
    viewId: string;
    presentation: "page" | "modal";
    label?: string;
    title?: string;
};
export type DashboardCreateOperation = DashboardDetailOpenRef;
export type DashboardDetailCreation = { label?: string; title?: string };

/** Modal controls currently have local scalar state and static choices only. */
export const DASHBOARD_MODAL_FIELD_TYPES = [
    "text",
    "textarea",
    "number",
    "money",
    "checkbox",
    "select",
    "combobox",
    "tokens",
    "secret-ref",
    "page-link",
] as const;

type ModalField = Extract<DashboardField, { type: (typeof DASHBOARD_MODAL_FIELD_TYPES)[number] }>;
type StaticModalField<T> = T extends ModalField
    ? Omit<T, "visibleWhen" | "lookup"> & { visibleWhen?: never; lookup?: never }
    : never;

/** Action forms support scalar controls and static choices, not full detail sections. */
export type DashboardActionField = StaticModalField<ModalField>;
