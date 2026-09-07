import type { IntegrationInstallationRow } from "../../Integrations/model";

export function sourceForInstallation(id: string, installations: IntegrationInstallationRow[]): string | undefined {
    const item = installations.find((item) => item.id === id);
    return (
        item?.sourceIds?.[0] ?? installations.find((parent) => parent.id === item?.extensionOf?.kind)?.sourceIds?.[0]
    );
}
