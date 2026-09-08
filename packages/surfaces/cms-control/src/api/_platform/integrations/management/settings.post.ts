import type { ControlCms } from "cms-control/ControlCms";
import {
    managementRequest,
    managementActor,
} from "cms-control/core/management/integrations/installationActions/management/request";
import { readInstallationActionBody } from "cms-control/core/management/integrations/installationActions";
export default async function management(req: Request, cms: ControlCms): Promise<Response> {
    const { id, service } = managementRequest(req, cms);
    const input = await readInstallationActionBody(req);
    input.expectedRevision ??= null;
    return Response.json(await service.saveSettings(id, input, await managementActor(req, cms)));
}
