import { valueAt } from "../../../../runtime/expressions";
import type { WDetailField } from "../../types";

export function deriveTableRows(field: WDetailField, sourceValue: unknown): Record<string, unknown>[] {
    if (field.derive?.type !== "cartesian") {
        return [];
    }
    const axes = Array.isArray(sourceValue)
        ? sourceValue
              .filter(
                  (row): row is Record<string, unknown> =>
                      row !== null && typeof row === "object" && !Array.isArray(row),
              )
              .map((row, index) => ({
                  label: textValue(valueAt(row, field.derive!.labelPath)),
                  values: listValue(valueAt(row, field.derive!.valuesPath)),
                  position: index,
              }))
              .filter((axis) => axis.label && axis.values.length)
        : [];
    if (!axes.length) {
        return [];
    }
    return axes
        .reduce<Array<Array<{ label: string; value: string }>>>(
            (sets, axis) => sets.flatMap((set) => axis.values.map((value) => [...set, { label: axis.label, value }])),
            [[]],
        )
        .map((choices, index) => ({
            key: choices.map((choice) => `${slug(choice.label)}:${slug(choice.value)}`).join("|"),
            options: choices.map((choice) => choice.value).join(" / "),
            title: choices.map((choice) => `${choice.label}: ${choice.value}`).join(" / "),
            status: "inactive",
            position: index,
        }));
}

function listValue(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}

function textValue(value: unknown): string {
    return value === null || value === undefined ? "" : String(value).trim();
}

function slug(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
