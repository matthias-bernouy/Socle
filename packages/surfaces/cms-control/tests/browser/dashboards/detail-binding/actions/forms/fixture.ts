import type { Page } from "playwright";
import { dashboard, source, bundle, styles } from "../navigation/definition";

export async function mountEditor(page: Page, collection = "formsTable", row?: string) {
    const state = {
        form: {
            id: 1,
            key: "contact",
            title: "Contact",
            description: "Description",
            accessMode: "public",
            status: "draft",
        },
        question: {
            ref: "question-ref",
            sectionRef: "section-ref",
            formKey: "contact",
            key: "format",
            label: "Format",
            type: "choice",
            required: true,
            multiple: true,
            presentation: "chips",
            hint: "",
            placeholder: "",
            options: [
                { key: "first", label: "First", position: 0 },
                { key: "second", label: "Second", position: 1 },
            ],
        } as Record<string, any>,
        reads: [] as string[],
        writes: [] as Array<{ endpoint: string; body: any }>,
        errors: [] as string[],
        failSave: false,
        failRead: false,
        delay: 0,
    };
    page.on("pageerror", (error) => state.errors.push(error.message));
    await page.route("http://cms.test/**", async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const endpoint = url.pathname.split("/").at(-1)!;
        if (req.resourceType() === "document") {
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
                        endpoints: source.endpoints,
                    },
                ],
            });
        } else if (url.pathname.startsWith("/.cms/sources/forms/")) {
            if (req.method() === "GET") {
                state.reads.push(endpoint);
                if (state.failRead && ["manageForm", "manageQuestion"].includes(endpoint)) {
                    state.failRead = false;
                    await route.fulfill({ status: 503, json: { error: "Read temporarily unavailable" } });
                    return;
                }
                await route.fulfill({
                    json:
                        endpoint === "manageForm"
                            ? url.searchParams.has("key")
                                ? state.form
                                : {
                                      id: null,
                                      key: "",
                                      title: "",
                                      description: "",
                                      accessMode: "public",
                                      status: "draft",
                                  }
                            : endpoint === "manageQuestion"
                              ? state.question
                              : endpoint === "manageForms"
                                ? { items: [state.form], total: 1 }
                                : { items: [] },
                });
            } else {
                const body = req.postDataJSON();
                state.writes.push({ endpoint, body });
                if (state.delay) {
                    await new Promise((resolve) => setTimeout(resolve, state.delay));
                }
                if (state.failSave) {
                    state.failSave = false;
                    await route.fulfill({ status: 422, json: { error: "Save rejected" } });
                    return;
                }
                if (endpoint === "saveFormDraft") {
                    state.form = { ...state.form, ...body, title: body.title.trim(), id: body.id ?? 2 };
                }
                if (endpoint === "saveQuestion") {
                    state.question = {
                        ...state.question,
                        ...body,
                        ref: `question-${body.key}`,
                        options: body.imageOptions ?? body.options ?? [],
                    };
                }
                await route.fulfill({ json: endpoint === "saveFormDraft" ? state.form : state.question });
            }
        } else {
            await route.fulfill({ json: [] });
        }
    });
    await page.goto(
        `http://cms.test/admin/sources?source=forms&dashboard=forms-forms&collection=${collection}${row ? `&row=${encodeURIComponent(row)}` : ""}`,
    );
    return state;
}
