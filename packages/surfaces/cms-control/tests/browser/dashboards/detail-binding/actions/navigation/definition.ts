import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveIntegrationDefinitionFile } from "@bernouy/cms-integrations/fs";
import type { DashboardDto } from "@bernouy/cms-dashboards";

const root = dirname(
    fileURLToPath(import.meta.resolve("@bernouy/cms-official-integrations/integrations/forms/definition.json")),
);
const definition = (await resolveIntegrationDefinitionFile(`${root}/definition.json`, root)) as {
    artifacts: Array<{
        type: string;
        view?: DashboardDto;
        source?: { endpoints: Array<{ endpointId: string; method: string; params: unknown[] }> };
    }>;
};
export const dashboard = definition.artifacts.find((artifact) => artifact.view?.id === "forms-forms")!.view!;
export const source = definition.artifacts.find((artifact) => artifact.type === "source")!.source!;
export const bundle = await Bun.file(
    resolve("packages/surfaces/cms-control/src/static/assets/control-components.js"),
).text();
export const styles = await Bun.file(resolve("packages/foundation/components/dist/style.css")).text();
