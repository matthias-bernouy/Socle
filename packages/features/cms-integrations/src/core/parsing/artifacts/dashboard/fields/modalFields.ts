import { DASHBOARD_MODAL_FIELD_TYPES, type DashboardActionField } from "@bernouy/cms-dashboards";
import { IntegrationInputError } from "../../../../errors";
import { parseFields } from ".";

export function parseModalFields(value: unknown, path: string): DashboardActionField[] {
    const fields = parseFields(value, path);
    fields.forEach((field, index) => {
        const name = `${path}.${index}`;
        if (!(DASHBOARD_MODAL_FIELD_TYPES as readonly string[]).includes(field.type)) {
            throw new IntegrationInputError(`${name}.type`, "is not supported by modal forms yet");
        }
        if (field.visibleWhen !== undefined) {
            throw new IntegrationInputError(`${name}.visibleWhen`, "is not supported by modal forms yet");
        }
        if ((field.type === "combobox" || field.type === "tokens") && field.lookup !== undefined) {
            throw new IntegrationInputError(
                `${name}.lookup`,
                "is not supported by modal forms yet; use static options",
            );
        }
    });
    return fields as DashboardActionField[];
}
