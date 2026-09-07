import type { DashboardField } from "@bernouy/cms-dashboards";
import type { Page } from "playwright";
import { installReadonlyRoutes } from "../../fixture";

type Choice = {
    id: string;
    label: string;
    page: string;
    credential: string;
    photo: { id: string; url: string; alt: string } | null;
    position: number;
    hidden: string;
};

export async function installNestedRoutes(page: Page, bundle: string, styles: string) {
    const resource = {
        id: "quality-choices",
        title: "Choice connections and images",
        notes: "Saved notes",
        choices: [
            {
                id: "agency",
                label: "Agency",
                page: "/terms",
                credential: "${QUALITY_FIRST}",
                photo: { id: "front", url: "/example.svg", alt: "Agency image" },
                position: 0,
                hidden: "first",
            },
            { id: "client", label: "Client", page: "", credential: "", photo: null, position: 1, hidden: "second" },
        ] as Choice[],
    };
    const field: DashboardField = {
        id: "choices",
        path: "choices",
        label: "Choices",
        type: "reorderable-list",
        itemKey: "id",
        layout: "cards",
        fields: [
            { id: "label", path: "label", label: "Label" },
            {
                id: "photo",
                path: "photo",
                label: "Choice image",
                type: "media",
                item: { idPath: "id", urlPath: "url", altPath: "alt" },
                actions: {
                    upload: { endpoint: "uploadMedia", params: { choice: "$media.itemKey" } },
                    replace: {
                        endpoint: "replaceMedia",
                        params: { choice: "$media.itemKey", previous: "$media.previousItem.id" },
                    },
                    remove: { endpoint: "removeMedia", body: { choice: "$media.itemKey", id: "$media.item.id" } },
                },
            },
            {
                id: "page",
                path: "page",
                label: "Legal page",
                type: "page-link",
                publishedOnly: true,
                allowExternal: false,
                allowMedia: false,
                secondary: true,
            },
            { id: "credential", path: "credential", label: "Credential", type: "secret-ref", secondary: true },
        ],
    };
    const fixture = await installReadonlyRoutes(page, bundle, styles, {
        resource,
        normalize: (value) => Object.assign(resource, value),
        fields: [field, { id: "notes", path: "notes", label: "Notes", type: "textarea" }],
        extraEndpoints: ["upload", "replace", "remove"].map((action) => ({
            endpointId: `${action}Media`,
            method: "POST",
            params: [],
        })),
    });
    const pageReads: string[] = [];
    const secretReads: string[] = [];
    await page.route("**/api/page/links*", async (route) => {
        pageReads.push(route.request().url());
        await route.fulfill({
            json: [
                { path: "/terms", title: "Terms" },
                { path: "/privacy", title: "Privacy" },
            ],
        });
    });
    await page.route("**/api/secrets/keys", async (route) => {
        secretReads.push(route.request().method());
        await route.fulfill({ json: ["QUALITY_FIRST", "QUALITY_SECOND"] });
    });
    const calls: Array<{ action: string; params: Record<string, string>; body?: unknown; files: File[] }> = [];
    let pending: Promise<void> | undefined;
    let fail = false;
    await page.route("**/.cms/sources/store/*Media*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const action = url.pathname.split("/").at(-1)!.replace("Media", "");
        const files: File[] = [];
        let body: unknown;
        if (request.headers()["content-type"]?.startsWith("multipart/form-data")) {
            const form = await new Response(new Uint8Array(request.postDataBuffer() ?? []).buffer, {
                headers: { "content-type": request.headers()["content-type"]! },
            }).formData();
            for (const value of form.values()) {
                if (typeof value !== "string") {
                    files.push(value);
                }
            }
        } else {
            body = request.postDataJSON();
        }
        calls.push({ action, params: Object.fromEntries(url.searchParams), body, files });
        const serial = calls.length;
        await pending;
        if (fail) {
            fail = false;
            await route.fulfill({ status: 503, json: { error: "Choice media unavailable" } });
            return;
        }
        // Nested media endpoints return an asset; the detail save persists the parent choices.
        await route.fulfill({
            json:
                action === "remove"
                    ? { ok: true }
                    : {
                          media: {
                              id: `uploaded-${serial}`,
                              url: `/example.svg?asset=${serial}`,
                              alt: files[0]?.name ?? "Uploaded image",
                          },
                      },
        });
    });
    return {
        ...fixture,
        resource,
        pageReads,
        secretReads,
        calls,
        fail() {
            fail = true;
        },
        holdMedia() {
            let release = () => {};
            pending = new Promise<void>((resolve) => {
                release = resolve;
            });
            return release;
        },
    };
}
