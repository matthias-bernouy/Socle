import { resolve } from "node:path";
import { resolveIntegrationDefinitionFile } from "@bernouy/cms-integrations/fs";

export const root = resolve(import.meta.dir, "../../../../../../../../..");
const base = `${root}/packages/resources/official-integrations/integrations`;
export const migrated = {
    "domains/commerce": [
        "commerceSettings",
        "notificationSettings",
        "protectedC2cPolicySettings",
        "conditionDetail",
        "customFieldDetail",
        "workflowStateDetail",
        "workflowTransitionDetail",
    ],
    "domains/forms": ["formDetail", "sectionDetail", "submissionDetail"],
    "domains/user-account": ["accountDetail", "extraFieldDetail"],
    "providers/emailer": ["templateDetail"],
    "providers/mondial-relay": ["shipmentDetail", "settingsDetail"],
    "extensions/commerce-negotiation": ["proposalDetail", "negotiationSettings"],
    "extensions/commerce-stripe-payments": [
        "protectedPaymentDetail",
        "claimDetail",
        "refundRequestDetail",
        "stripeDisputeDetail",
        "providerExceptionDetail",
    ],
};
export const definitions = await Promise.all(
    [...Object.keys(migrated), "providers/stripe-connect"].map(async (integration) => ({
        integration,
        definition: (await resolveIntegrationDefinitionFile(
            `${base}/${integration}/definition.json`,
            `${base}/${integration}`,
        )) as any,
    })),
);
export function objects(value: any): any[] {
    if (!value || typeof value !== "object") {
        return [];
    }
    return [value, ...Object.values(value).flatMap(objects)];
}
export const cases = definitions.flatMap(({ integration, definition }) =>
    definition.artifacts.flatMap((artifact: any) =>
        artifact.view
            ? objects(artifact.view)
                  .filter(
                      (item) =>
                          item.widget === "w-detail" &&
                          migrated[integration as keyof typeof migrated]?.includes(item.id),
                  )
                  .map((widget) => ({ integration, widget, dashboard: artifact.view }))
            : [],
    ),
) as Array<{ integration: string; widget: any; dashboard: any }>;

export function setPath(target: any, path: string, value: any): void {
    const parts = path.split(".");
    const key = parts.pop()!;
    for (const part of parts) {
        target = target[part] ??= {};
    }
    target[key] = value;
}
export function resourceFor(widget: any): Record<string, any> {
    const resource: any = {
        id: 42,
        version: 7,
        orderId: 42,
        externalOrderId: "order-42",
        status: "pending",
        settlementStatus: "held",
        settlement: { version: 7 },
        details: { projectionId: 42, interventionRevision: 7 },
        updatedAt: "2026-09-08T12:00:00Z",
        stagedEvidenceOperationId: "operation-7",
    };
    const fields = [...(widget.main ?? []), ...(widget.aside ?? [])].flatMap((s: any) => s.fields ?? []);
    for (const field of [...fields, ...(widget.actions ?? []).flatMap((a: any) => a.form?.fields ?? [])]) {
        if (field.type === "readonly") {
            continue;
        }
        const value =
            field.type === "checkbox"
                ? false
                : field.type === "number"
                  ? 10
                  : ["tokens", "table", "reorderable-list"].includes(field.type)
                    ? []
                    : (field.options?.[0]?.value ?? "Initial value");
        setPath(resource, field.path, field.valueType === "boolean" ? value === true || value === "true" : value);
    }
    for (const operation of [widget.save, widget.delete, ...(widget.actions ?? []).map((a: any) => a.form)].filter(
        Boolean,
    )) {
        for (const field of operation.hiddenFields ?? []) {
            if (typeof field.value === "string" && field.value.startsWith("$resource.")) {
                const path = field.value.slice(10);
                let value = path.split(".").reduce((n: any, key: string) => n?.[key], resource);
                if (value == null) {
                    value = field.type === "number" ? 7 : field.type === "boolean" ? false : "stable-reference";
                    setPath(resource, path, value);
                }
            }
        }
    }
    if (widget.id === "refundRequestDetail") {
        resource.status = "requested";
    }
    if (widget.id === "claimDetail") {
        resource.status = "open";
    }
    if (widget.id === "providerExceptionDetail") {
        resource.exception_type = "commerce_projection_delivery_failed";
    }
    if (widget.id === "stripeDisputeDetail") {
        resource.status = "needs_response";
        resource.evidenceStatus = "staged";
    }
    if (widget.id === "shipmentDetail") {
        resource.status = "unknown";
    }
    if (widget.id === "extraFieldDetail") {
        resource.id = "preference";
    }
    return resource;
}

export function endpointFor(entry: { integration: string }, operation: any): any {
    const owner = operation.sourceId ? "providers/stripe-connect" : entry.integration;
    const preferred = definitions.find((item) => item.integration === owner)!;
    for (const definition of [preferred.definition, ...definitions.map((item) => item.definition)]) {
        const endpoint = objects(definition).find((item) => item.endpointId === operation.endpoint && item.method);
        if (endpoint) {
            return endpoint;
        }
    }
    throw new Error(`Missing endpoint ${operation.endpoint}`);
}
