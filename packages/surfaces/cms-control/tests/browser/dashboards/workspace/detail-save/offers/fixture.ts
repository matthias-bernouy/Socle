import { resolve } from "node:path";
import type { Page } from "playwright";
import { resolveIntegrationDefinitionFile } from "@bernouy/cms-integrations/fs";

const root = resolve(import.meta.dir, "../../../../../../../../..");
const commerce = `${root}/packages/resources/official-integrations/integrations/domains/commerce`;
const definition = (await resolveIntegrationDefinitionFile(`${commerce}/definition.json`, commerce)) as {
    artifacts: any[];
};
const bundle = await Bun.file(`${root}/packages/surfaces/cms-control/src/static/assets/control-components.js`).text();
const styles = await Bun.file(`${root}/packages/foundation/components/dist/style.css`).text();

export async function offerFixture(page: Page, startNew = false) {
    const dashboardId = "commerce-offers";
    const artifact = definition.artifacts.find((entry: any) => entry.view?.id === dashboardId) as any;
    const source = definition.artifacts.find((entry: any) => entry.type === "source") as any;
    const dashboard = { ...artifact.view, source: "commerce" };
    const state = {
        resource: {
            id: startNew ? null : 42,
            version: startNew ? null : 7,
            creationToken: startNew ? "11111111-1111-4111-8111-111111111111" : undefined,
            title: startNew ? "" : "Review racket",
            slug: "review-racket",
            description: "Original description",
            displayName: "Racket seller",
            verificationStatus: "pending",
            kind: "user",
            cmsUserId: "seller-user",
            workflowState: "draft",
            publicationStatus: "draft",
            availability: "available",
            currency: "EUR",
            wholeUnitPrices: false,
            acceptedPriceAmount: 1500,
            priceRule: { minimumAmount: 1250, maximumAmount: 1875 },
            reviewReason: "Previous review",
            productId: 1,
            sellerId: 2,
            conditionCode: "good",
            media: [],
            variantId: null,
            quantityAvailable: null,
            seller: { id: 2, displayName: "Test seller" },
            product: { id: 1, title: "Test product" },
        } as Record<string, any>,
        reads: 0,
        uploads: 0,
        failRead: false,
        writes: [] as Record<string, any>[],
        fail: false,
        errors: [] as string[],
        pending: undefined as Promise<void> | undefined,
    };
    page.on("pageerror", (error) => state.errors.push(error.message));
    const read = "manageOffer";
    const write = "upsertOffer";
    await page.route("http://cms.test/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const endpoint = path.split("/").at(-1);
        if (path === "/control.js") {
            await route.fulfill({ contentType: "text/javascript", body: bundle });
        } else if (path === "/style.css") {
            await route.fulfill({ contentType: "text/css", body: styles });
        } else if (route.request().resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><head><link rel="stylesheet" href="/style.css"><script src="/control.js"></script></head><body><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-nav slot="secondary-lateral-nav"></cms-dashboards-nav><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core></body>',
            });
        } else if (path === "/api/dashboards") {
            await route.fulfill({
                json: [
                    {
                        source: {
                            id: "commerce",
                            name: "Commerce",
                            urn: "urn:commerce",
                            readonly: false,
                            endpointCount: source.source.endpoints.length,
                            dashboardCount: 1,
                        },
                        endpoints: source.source.endpoints,
                        dashboards: [dashboard],
                    },
                ],
            });
        } else if (endpoint === read) {
            state.reads++;
            if (state.failRead) {
                state.failRead = false;
                await route.fulfill({ status: 503, json: { error: "Read unavailable" } });
            } else {
                await route.fulfill({ json: state.resource });
            }
        } else if (endpoint === "stageOfferImage") {
            state.uploads++;
            await route.fulfill({
                json: {
                    sessionId: "11111111-1111-4111-8111-111111111111",
                    media: { id: 100 + state.uploads, name: "test.png", previewUrl: "/image.png" },
                },
            });
        } else if (path === "/image.png" || endpoint === "offerImage") {
            await route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="green"/></svg>',
            });
        } else if (endpoint === write) {
            const body = route.request().postDataJSON();
            state.writes.push(body);
            await state.pending;
            if (state.fail) {
                state.fail = false;
                await route.fulfill({ status: 409, json: { error: "Review rejected" } });
            } else {
                state.resource = {
                    ...state.resource,
                    ...body,
                    id: 42,
                    version: (state.resource.version ?? 0) + 1,
                    media: body.mediaIds.map((id: number) => ({ media: { id, url: "", alt: "Test image" } })),
                };
                delete state.resource.creationToken;
                await route.fulfill({ json: state.resource });
            }
        } else {
            await route.fulfill({
                json: {
                    items: [
                        { id: 1, title: "Test product" },
                        { id: 2, displayName: "Test seller" },
                        { code: "good", label: "Good" },
                        { code: "draft", label: "Draft" },
                    ],
                },
            });
        }
    });
    return {
        state,
        url: `http://cms.test/admin/sources?source=commerce&dashboard=${dashboardId}&collection=offerDetail&row=${startNew ? "__new__" : "42"}`,
        read,
        write,
    };
}
