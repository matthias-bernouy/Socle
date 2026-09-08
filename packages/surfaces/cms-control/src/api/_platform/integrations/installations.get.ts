import { parseUrn } from "@bernouy/cms-sources";
import type { ControlCms } from "cms-control/ControlCms";
import {
    buildIntegrationInstallationView,
    loadIntegrationArtifactContext,
} from "cms-control/core/management/integrations/presentation/installationViews";

export default async function getIntegrationInstallations(req: Request, cms: ControlCms) {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
        const installation = await cms.integrationInstallations.get(id);
        if (!installation) {
            return new Response("Not found", { status: 404 });
        }
        const context = await loadIntegrationArtifactContext(cms);
        const parentId = installation.definitionSnapshot?.extensionOf?.kind;
        const owner = installation.artifacts.some((artifact) => artifact.type === "source")
            ? installation
            : parentId
              ? await cms.integrationInstallations.get(parentId)
              : undefined;
        const sourceArtifact = owner?.artifacts.find((artifact) => artifact.type === "source");
        return Response.json({
            ...buildIntegrationInstallationView(context, installation, true),
            settingsSourceId: sourceArtifact ? (parseUrn(sourceArtifact.id)?.source ?? sourceArtifact.id) : undefined,
        });
    }

    const context = await loadIntegrationArtifactContext(cms);
    const installations = await cms.integrationInstallations.list();
    return Response.json(
        installations.map((installation) => buildIntegrationInstallationView(context, installation, false)),
    );
}
