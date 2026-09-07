import type { Page } from "playwright";
import { mountShell } from "../detail-shell/fixture";

export async function mountSave(page: Page) {
    const state = {
        reads: 0,
        otherReads: 0,
        writes: [] as Record<string, unknown>[],
        revision: 7,
        saveStatus: 204,
        readStatus: 200,
        saveDelay: 0,
        readDelay: 0,
        title: "Original",
    };
    const errors = await mountShell(
        page,
        `
        <section id="detail" cms-source="/record?id=#{id} as item">
            <p cms-condition="$source.loading">Loading record</p>
            <div cms-condition="$source.loaded">
                <cms-shell-detail>
                    <span slot="title">Product</span>
                    <p9r-button slot="actions" form="save" type="submit">Save product</p9r-button>
                    <form slot="body" id="save" cms-source="/save" cms-source-trigger="submit"
                        cms-source-serialization="typed-json" cms-source-success-reload="#detail">
                        <input type="hidden" name="id" value="{{ item.id }}">
                        <input type="hidden" name="expectedRevision" value="{{ item.revision }}" cms-form-value-type="number">
                        <cms-shell-detail-body>
                            <div slot="main">
                                <p9r-input name="title" label="Title" value="{{ item.title }}"></p9r-input>
                                <p9r-token-input name="tags" value="{{ item.tags }}"></p9r-token-input>
                                <article cms-repeat="item.rows as row"><span>{{ row.name }}</span></article>
                            </div>
                            <div slot="aside">
                                <input name="quantity" type="number" value="{{ item.quantity }}">
                                <w13c-switch name="enabled" cms-bind-boolean-checked="item.enabled"></w13c-switch>
                                <p>Reference <strong>{{ item.id }}</strong></p>
                            </div>
                        </cms-shell-detail-body>
                        <span cms-condition="$source.error" id="save-error">{{ $source.message }}</span>
                    </form>
                </cms-shell-detail>
                <form id="operation" cms-source="/operation" cms-source-trigger="submit" cms-source-success-reload="#detail">
                    <input name="id" type="hidden" value="{{ item.id }}">
                    <input name="expectedRevision" type="hidden" value="{{ item.revision }}">
                    <button type="submit">Independent action</button>
                </form>
            </div>
            <span cms-condition="$source.refreshError" id="refresh-error">Saved; reload failed</span>
        </section>
        <section cms-source="/other"><p>{{ name }}</p></section>`,
        async (route, url) => {
            if (url.pathname === "/record") {
                state.reads++;
                await delay(state.readDelay);
                await route.fulfill({
                    status: state.readStatus,
                    json: {
                        id: "p1",
                        title: state.title,
                        revision: state.revision,
                        quantity: 0,
                        enabled: false,
                        tags: ["tennis", "padel"],
                        rows: [{ name: "Row A" }, { name: "Row B" }],
                    },
                });
            } else if (url.pathname === "/save" || url.pathname === "/operation") {
                state.writes.push(route.request().postDataJSON());
                await delay(state.saveDelay);
                if (state.saveStatus === 204) {
                    state.revision++;
                    await route.fulfill({ status: 204 });
                } else {
                    await route.fulfill({ status: state.saveStatus, json: { message: "Version conflict" } });
                }
            } else {
                state.otherReads++;
                await route.fulfill({ json: { name: "Unrelated source" } });
            }
        },
    );
    await page.locator('p9r-input[name="title"] input').waitFor();
    return { state, errors };
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
