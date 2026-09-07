import type { DashboardFieldBase } from "@bernouy/cms-dashboards";
import { IntegrationInputError } from "../../../../errors";
import { optionalText } from "../../common";

export function parseFormFieldOptions(
    value: Record<string, unknown>,
    path: string,
): Pick<DashboardFieldBase, "name" | "empty" | "valueType"> {
    const name = optionalText(value.name, `${path}.name`);
    const empty = value.empty;
    const valueType = value.valueType;
    if (empty !== undefined && empty !== "null" && empty !== "omit") {
        throw new IntegrationInputError(`${path}.empty`, "must be null or omit");
    }
    if (valueType !== undefined && valueType !== "string" && valueType !== "number" && valueType !== "boolean") {
        throw new IntegrationInputError(`${path}.valueType`, "must be string, number, or boolean");
    }
    return {
        ...(name !== undefined ? { name } : {}),
        ...(empty !== undefined ? { empty } : {}),
        ...(valueType !== undefined ? { valueType } : {}),
    };
}
