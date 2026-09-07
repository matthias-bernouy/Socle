import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
    productValuation,
    readProducts,
    valuationMoney,
} from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/commerce/offers/catalogue/valuation/presentation.ts";
import { Bloc as SearchInput } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/foundation/forms/fields/search-input/Bloc.ts";
import { OFFICIAL_INTEGRATIONS_ROOT } from "@bernouy/cms-official-integrations";

describe("Commerce catalogue valuation", () => {
    test("keeps editable copy in authored slots and transport in one declarative source", async () => {
        const root = resolve(
            OFFICIAL_INTEGRATIONS_ROOT,
            "collections/mossa/blocs/domains/commerce/offers/catalogue/valuation",
        );
        const [controller, template, defaultContent, editor] = await Promise.all([
            Bun.file(resolve(root, "controller/Bloc.ts")).text(),
            Bun.file(resolve(root, "template.html")).text(),
            Bun.file(resolve(root, "default.html")).text(),
            Bun.file(resolve(root, "BlocEditor.ts")).text(),
        ]);

        for (const slot of ["heading-title", "searching-message", "selected-model-message", "range-description"]) {
            expect(template).toContain(`slot name="${slot}"`);
            expect(defaultContent).toContain(`slot="${slot}"`);
            expect(editor).toContain(`"${slot}"`);
        }
        expect(template.match(/cms-source=/g)).toHaveLength(1);
        expect(template).toContain('cms-repeat="items as product"');
        expect(template).toContain('name="q"');
        expect(controller).not.toContain("fetch(");
        expect(controller).not.toContain('getAttribute("locale")');
    });

    test("derives the selected catalogue valuation from configurable metadata fields", () => {
        const [product] = readProducts({
            items: [
                {
                    id: 1,
                    title: "Generic product",
                    description: "Reusable catalogue product",
                    metadata: { estimateFloor: 120, estimateCeiling: 155 },
                },
            ],
        });
        expect(product).toEqual({
            id: "1",
            title: "Generic product",
            description: "Reusable catalogue product",
            metadata: { estimateFloor: 120, estimateCeiling: 155 },
        });
        expect(productValuation(product?.metadata, "estimateFloor", "estimateCeiling")).toEqual({
            minimum: 120,
            maximum: 155,
        });
        expect(valuationMoney(120, "EUR", "en-US")).toContain("120");
    });

    test("uses the generic search field through its public value contract", () => {
        const tag = "test-mossa-valuation-search-input";
        if (!customElements.get(tag)) {
            customElements.define(tag, class extends SearchInput {});
        }
        const search = document.createElement(tag) as SearchInput;
        document.body.append(search);
        search.value = "Sample model";
        expect(search.value).toBe("Sample model");
        expect(search.shadowRoot?.querySelector("input")?.value).toBe("Sample model");
        search.remove();
    });
});
