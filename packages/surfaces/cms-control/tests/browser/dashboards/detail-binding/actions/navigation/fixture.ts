import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
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
const dashboard = definition.artifacts.find((artifact) => artifact.view?.id === "forms-forms")!.view!;
const source = definition.artifacts.find((artifact) => artifact.type === "source")!.source!;
const bundle = await Bun.file(resolve("packages/surfaces/cms-control/src/static/assets/control-components.js")).text();
const styles = await Bun.file(resolve("packages/foundation/components/dist/style.css")).text();
export const formKey = "contact / é? &test";
export const sectionRef = "section / é? &test";
export const questionRef = "question / é? &test";

export async function mountForms(page: Page, missingParent = false) {
    const requests: Array<{ method: string; endpoint: string; params: Record<string, string> }> = [];
    const errors: string[] = [];
    let failSection = false;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://cms.test/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core><script src="/control.js"></script>',
            });
        } else if (url.pathname === "/control.js") {
            await route.fulfill({ contentType: "text/javascript", body: bundle });
        } else if (url.pathname === "/style.css") {
            await route.fulfill({ contentType: "text/css", body: styles });
        } else if (url.pathname === "/api/dashboards") {
            await route.fulfill({
                json: [
                    {
                        source: {
                            id: "forms",
                            urn: "urn:forms",
                            name: "Forms",
                            dashboardCount: 1,
                            endpointCount: source.endpoints.length,
                        },
                        dashboards: [dashboard],
                        endpoints: source.endpoints.map((endpoint) => ({
                            ...endpoint,
                            endpointId: endpoint.endpointId,
                        })),
                    },
                ],
            });
        } else if (url.pathname.startsWith("/.cms/sources/forms/")) {
            const endpoint = url.pathname.split("/").at(-1)!;
            requests.push({ method: request.method(), endpoint, params: Object.fromEntries(url.searchParams) });
            if (endpoint === "manageSection" && failSection) {
                failSection = false;
                await route.fulfill({ status: 503, json: { error: "Section temporarily unavailable" } });
                return;
            }
            const data: Record<string, unknown> = {
                manageQuestion: {
                    ref: questionRef,
                    sectionRef: missingParent ? null : sectionRef,
                    label: "Question",
                    type: "text",
                    key: "question",
                    required: false,
                    multiple: false,
                    options: [],
                    imageOptions: [],
                },
                manageSection: {
                    ref: sectionRef,
                    formKey,
                    sectionId: "section",
                    title: "Section title",
                    description: "",
                    questionCount: 1,
                },
                manageForm: {
                    key: formKey,
                    title: "Contact form",
                    description: "",
                    accessMode: "public",
                    status: "draft",
                    draftDefinition: { sections: [] },
                },
                manageSections: { items: [{ id: sectionRef, title: "Section title" }] },
                manageQuestions: { items: [{ id: questionRef, title: "Question" }] },
            };
            await route.fulfill({ json: data[endpoint] ?? { items: [] } });
        } else {
            await route.fulfill({ json: [] });
        }
    });
    await page.goto(
        `http://cms.test/admin/sources?source=forms&dashboard=forms-forms&collection=questionDetail&row=${encodeURIComponent(questionRef)}`,
    );
    await page.locator('[data-action="backToSection"]').waitFor();
    return {
        requests,
        errors,
        failNextSection: () => {
            failSection = true;
        },
    };
}
