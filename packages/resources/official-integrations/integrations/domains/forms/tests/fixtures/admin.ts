import { afterEach, beforeEach } from "bun:test";
import { registrationForm } from "./registration";

const originalFetch = globalThis.fetch;
const adminHeaders = {
    authorization: "Bearer cms_forms_test",
    "content-type": "application/json",
    "x-cms-user-id": "admin-1",
    "x-cms-user-role": "admin",
};

export let managed: Record<string, unknown>;
let submission: Record<string, unknown>;

export function response(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

export function adminRequest(path: string, body?: Record<string, unknown>): Request {
    return new Request(`https://cms.example.test/cms-forms${path}`, {
        method: body ? "POST" : "GET",
        headers: adminHeaders,
        body: body ? JSON.stringify(body) : undefined,
    });
}

export function useAdminFixture(): void {
    beforeEach(() => {
        Object.defineProperty(globalThis, "Deno", {
            configurable: true,
            value: {
                env: {
                    get(name: string) {
                        return {
                            CMS_FORMS_API_KEY: "cms_forms_test",
                            SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
                            SUPABASE_URL: "https://database.example.test",
                        }[name];
                    },
                },
            },
        });
        managed = {
            id: 1,
            key: "event-registration",
            title: registrationForm.definition.title,
            description: registrationForm.definition.description,
            accessMode: registrationForm.accessMode,
            status: "draft",
            version: 1,
            draftDefinition: structuredClone(registrationForm.definition),
        };
        submission = {
            id: 42,
            receiptId: "9bd17b52-69dc-45da-9c4a-d0e947ba5a44",
            formKey: "event-registration",
            formVersion: 1,
            status: "received",
            submittedBy: null,
            createdAt: "2026-09-01T08:00:00Z",
            updatedAt: "2026-09-01T08:00:00Z",
            definition: structuredClone(registrationForm.definition),
            answers: { attendeeName: "Alex Morgan", session: "afternoon", consent: "true" },
        };
        globalThis.fetch = async (_input, init) => {
            const url = String(_input);
            const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
            if (url.endsWith("/rpc/get_managed_form")) {
                return response(managed);
            }
            if (url.endsWith("/rpc/list_managed_forms")) {
                return response({ items: [managed], total: 1 });
            }
            if (url.endsWith("/rpc/save_form_draft")) {
                managed.draftDefinition = structuredClone(body.p_definition);
                return response(managed);
            }
            if (url.endsWith("/rpc/get_submission")) {
                return response(submission);
            }
            if (url.endsWith("/rpc/update_submission_status")) {
                submission.status = body.p_status;
                return response({ ok: true });
            }
            return response({ message: `unexpected request: ${url}` }, 500);
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        Reflect.deleteProperty(globalThis, "Deno");
    });
}
