import type { DashboardEndpointRef } from "@bernouy/cms-dashboards";
import { resolveBody, type RuntimeVars } from "../../expressions";
import { sendSourceJson, sourceUrl } from "../../source";
import { stringFields, type SubmitAction } from ".";

/** Compatibility for definitions that have not migrated to real editable form controls. */
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
