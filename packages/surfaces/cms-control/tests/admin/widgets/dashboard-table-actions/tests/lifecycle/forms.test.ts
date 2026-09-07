import "cms-control/components";
import { afterEach, expect, test } from "bun:test";
import { ActionForms, stringFields } from "cms-control/components/admin/Resources/Dashboards/runtime/actions/forms";

const originalFetch = globalThis.fetch;
afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetch;
});

function mount(): { forms: ActionForms; core: HTMLElement } {
    const core = document.createElement("cms-binding-core");
    document.body.append(core);
    return { forms: new ActionForms(core), core };
}

test("action forms submit captured strings once and remove themselves after a result", async () => {
    const { forms, core } = mount();
    const requests: Request[] = [];
    globalThis.fetch = (async (url, init) => {
        requests.push(new Request(url, init));
        return Response.json({ id: "created" });
    }) as typeof fetch;
    const fields = { name: 'Original "name"', empty: "" };
    const pending = forms.submit({ url: "http://localhost/action?id=resource", method: "POST", fields });
    fields.name = "New edit";
    expect(await pending).toEqual({ id: "created" });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("http://localhost/action?id=resource");
    expect(await requests[0]!.json()).toEqual({ name: 'Original "name"', empty: "" });
    expect(core.querySelectorAll("form")).toHaveLength(0);
});

test("disconnect settles a pending form and prevents late completion from replacing it", async () => {
    const { forms, core } = mount();
    let release!: (response: Response) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
        started = resolve;
    });
    globalThis.fetch = (() =>
        new Promise<Response>((resolve) => {
            release = resolve;
            started();
        })) as unknown as typeof fetch;
    const pending = forms.submit({ url: "http://localhost/action", method: "POST", fields: { actionId: "repair" } });
    const rejected = pending.catch((error: unknown) => error);
    await requestStarted;
    expect(core.querySelector("form")?.hasAttribute("cms-ready")).toBeTrue();
    forms.disconnect();
    expect(await rejected).toBeInstanceOf(DOMException);
    expect(((await rejected) as Error).message).toContain("disconnected");
    release(Response.json({ ok: true }));
    expect(core.querySelectorAll("form")).toHaveLength(0);
});

test("only bodies preserved exactly by string form controls enter the form path", () => {
    expect(stringFields({ id: "a", name: "" })).toEqual({ id: "a", name: "" });
    expect(stringFields({})).toEqual({});
    for (const body of [
        undefined,
        { enabled: true },
        { price: 12 },
        { value: null },
        { values: {} },
        { ids: [] },
        { "items[]": "a" },
        { constructor: "a" },
        { _charset_: "custom" },
        { requestSubmit: "a" },
        { ownerDocument: "a" },
    ]) {
        expect(stringFields(body)).toBeNull();
    }
});
