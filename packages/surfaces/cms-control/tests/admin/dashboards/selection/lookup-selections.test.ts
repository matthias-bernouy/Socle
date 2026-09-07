import "../detail/boundDetail";
import { setSourceData } from "@bernouy/components";
import { afterEach, expect, test } from "bun:test";
import {
    distinctOptions,
    lookupPage,
    selectedLookupOptions,
} from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/lookups/options";

afterEach(() => document.body.replaceChildren());

function lookup(resource: unknown, selected: string, expression = "$resource.product"): HTMLElement {
    const detail = document.createElement("cms-dashboard-w-detail");
    setSourceData(detail, resource);
    const host = document.createElement("div");
    host.setAttribute("selected-value", selected);
    host.setAttribute("selected-expression", expression);
    host.setAttribute("value-path", "id");
    host.setAttribute("label-path", "title");
    host.setAttribute("items-path", "items");
    detail.append(host);
    return host;
}

test("projects the bound selected resource without a hydration request", () => {
    const host = lookup({ product: { id: "p1", title: "Racket" } }, "p1");
    expect(selectedLookupOptions(host)).toEqual([{ value: "p1", label: "Racket" }]);
});

test("retains the selected label when the option page fails", () => {
    const host = lookup({ product: { id: "p1", title: "Racket" } }, "p1");
    const page = lookupPage(host, { status: 503, message: "HTTP 503" });
    expect(distinctOptions([...page.options, ...selectedLookupOptions(host)])).toEqual([
        { value: "p1", label: "Racket" },
    ]);
});

test("deduplicates the fetched page against selected arrays", () => {
    const host = lookup(
        {
            selected: [
                { id: "a", title: "Snapshot A" },
                { id: "b", title: "Snapshot B" },
            ],
        },
        "a,b",
        "$resource.selected",
    );
    const page = lookupPage(host, { items: [{ id: "a", title: "Fresh A" }] });
    expect(distinctOptions([...page.options, ...selectedLookupOptions(host)])).toEqual([
        { value: "a", label: "Fresh A" },
        { value: "b", label: "Snapshot B" },
    ]);
});

test("rejects mismatched, unlabeled and obsolete selected expressions", () => {
    expect(selectedLookupOptions(lookup({ product: { id: "other", title: "Wrong" } }, "p1"))).toEqual([]);
    expect(selectedLookupOptions(lookup({ product: { id: "p1" } }, "p1"))).toEqual([]);
    expect(selectedLookupOptions(lookup({}, "p1", '{"endpoint":"product"}'))).toEqual([]);
});
