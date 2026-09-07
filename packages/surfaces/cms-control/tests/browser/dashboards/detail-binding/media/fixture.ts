import type { Page } from "playwright";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { installReadonlyRoutes } from "../fixture";

export const mediaPage =
    "http://cms.test/admin/sources?source=store&dashboard=summary&collection=detail&row=quality-media";
export const imageFile = {
    name: "quality-front.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#165f4b"/></svg>',
    ),
};
export type MediaRecord = { id: string; url: string; alt: string };

export async function installMediaRoutes(page: Page, bundle: string, styles: string, long = false) {
    const resource = {
        id: "quality-media",
        title: "Media settings",
        notes: "Saved notes",
        photos: ["front", "side", "back"].map((id) => ({ id, url: `/media/${id}.svg`, alt: `${id} view` })),
    };
    const actions = ["upload", "replace", "remove", "reorder"] as const;
    const calls: Array<{ action: string; params: Record<string, string>; body?: unknown; files: File[] }> = [];
    const field: DashboardField = {
        id: "photos",
        path: "photos",
        label: "Product images",
        type: "media",
        multiple: true,
        item: { idPath: "id", urlPath: "url", altPath: "alt" },
        actions: {
            upload: { endpoint: "uploadMedia", params: { record: "$resource.id" } },
            replace: { endpoint: "replaceMedia", params: { id: "$media.previousItem.id" } },
            remove: { endpoint: "removeMedia", body: { id: "$media.item.id" } },
            reorder: { endpoint: "reorderMedia", body: { ids: "$media.valueIds" } },
        },
    };
    const fixture = await installReadonlyRoutes(page, bundle, styles, {
        resource,
        normalize: (value) => Object.assign(resource, value),
        fields: [
            { id: "title", path: "title", label: "Title", type: "text" },
            ...(long
                ? Array.from(
                      { length: 15 },
                      (_, index): DashboardField => ({
                          id: `information${index}`,
                          path: "title",
                          label: `Information ${index + 1}`,
                          type: "readonly",
                      }),
                  )
                : []),
            field,
            { id: "notes", path: "notes", label: "Notes", type: "textarea" },
        ],
        extraEndpoints: actions.map((action) => ({ endpointId: `${action}Media`, method: "POST", params: [] })),
    });
    let serial = 0;
    let pending: Promise<void> | undefined;
    let fail = false;
    let failImage = false;
    await page.route("**/media/*.svg", async (route) => {
        if (failImage) {
            await route.fulfill({ status: 503, body: "Image unavailable" });
            return;
        }
        const id = new URL(route.request().url()).pathname.split("/").at(-1)!.replace(".svg", "");
        await route.fulfill({
            contentType: "image/svg+xml",
            body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${id === "side" ? "#d8b784" : "#48766a"}"/><text x="40" y="250" fill="white" font-size="48">${id} view</text></svg>`,
        });
    });
    await page.route("**/.cms/sources/store/*Media*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const action = url.pathname.split("/").at(-1)!.replace("Media", "");
        const files: File[] = [];
        let body: { id?: string; ids?: string[] } | undefined;
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
        await pending;
        if (fail) {
            fail = false;
            await route.fulfill({ status: 503, json: { error: "Media operation unavailable" } });
            return;
        }
        if (action === "upload" || action === "replace") {
            const item = {
                id: `uploaded-${++serial}`,
                url: `/media/uploaded-${serial}.svg`,
                alt: files[0]?.name ?? "Uploaded image",
            };
            resource.photos =
                action === "upload"
                    ? [...resource.photos, item]
                    : resource.photos.map((old) => (old.id === url.searchParams.get("id") ? item : old));
        } else if (action === "remove") {
            resource.photos = resource.photos.filter((item) => item.id !== body?.id);
        } else if (action === "reorder") {
            resource.photos = (body?.ids ?? []).flatMap((id) => resource.photos.filter((item) => item.id === id));
        }
        await route.fulfill({ json: { ok: true } });
    });
    return {
        ...fixture,
        calls,
        resource,
        fail() {
            fail = true;
        },
        failImages() {
            failImage = true;
        },
        holdAction() {
            let release = () => {};
            pending = new Promise<void>((resolve) => {
                release = resolve;
            });
            return release;
        },
    };
}
