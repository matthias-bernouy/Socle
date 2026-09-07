import type { DashboardEndpointRef } from "@bernouy/cms-dashboards";
import { resolveBody, type RuntimeVars } from "../../expressions";
import { sendSourceJson, sourceUrl } from "../../source";
import { stringFields, type SubmitAction } from ".";

/** Keep typed bodies on their existing path until form binding can preserve them. */
export async function submitEndpoint(
    sourceId: string,
    ref: DashboardEndpointRef,
    method: string,
    vars: RuntimeVars,
    submit?: SubmitAction,
): Promise<unknown> {
    const fields = stringFields(resolveBody(ref.body, vars));
    return submit && fields && ["POST", "PUT", "PATCH", "DELETE"].includes(method)
        ? submit({ url: sourceUrl(sourceId, ref, vars).href, method, fields })
        : sendSourceJson(sourceId, ref, method, vars);
}
