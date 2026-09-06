import { afterEach, describe, expect, test } from "bun:test";
import { resetDom, text } from "../testUtils";
import { mount } from "./compiledTemplateTestUtils";

afterEach(resetDom);

describe("CompiledTemplate — text and attributes", () => {
    test("mounts a fragment and binds text and attributes", () => {
        const { host } = mount(
            `
            <p>Hello {{ name }}</p>
            <a href="/users/{{ id }}" title="{{ name }}">Open</a>
        `,
            { name: "Ada", id: 1 },
        );

        expect(text(host.querySelector("p"))).toBe("Hello Ada");
        expect(host.querySelector("a")!.getAttribute("href")).toBe("/users/1");
        expect(host.querySelector("a")!.getAttribute("title")).toBe("Ada");
    });

    test("updates live sites without replacing unrelated nodes", () => {
        const { host, region } = mount(
            `
            <label>{{ label }}</label>
            <input name="email">
            <a href="/users/{{ id }}">Open</a>
        `,
            { label: "Email", id: 1 },
        );
        const input = host.querySelector("input")!;
        const link = host.querySelector("a")!;

        region.update({ value: { label: "Work email", id: 2 } });

        expect(text(host.querySelector("label"))).toBe("Work email");
        expect(host.querySelector("input")).toBe(input);
        expect(host.querySelector("a")).toBe(link);
        expect(link.getAttribute("href")).toBe("/users/2");
    });

    test("uses existing interpolation rules for misses and filters", () => {
        const { host } = mount(
            `<p>{{ name | up }} / {{ missing }}</p>`,
            { name: "ada" },
            { up: (value: unknown) => String(value).toUpperCase() },
        );

        expect(text(host.querySelector("p"))).toBe("ADA /");
    });
});

class ValueReceiver extends HTMLElement {
    readonly values: unknown[] = [];
    setBindingValue(value: unknown): void {
        this.values.push(value);
    }
}
customElements.define("test-value-receiver", ValueReceiver);

test("typed values reach an opt-in component without serialization and preserve the mounted element", () => {
    const data = { name: '<unsafe attr="value">', enabled: false };
    const { host, region } = mount('<test-value-receiver cms-bind-value="item"></test-value-receiver>', { item: data });
    const receiver = host.firstElementChild as ValueReceiver;
    expect(receiver.values).toEqual([data]);
    expect(receiver.values[0]).toBe(data);
    expect(receiver.outerHTML).not.toContain("unsafe");
    region.update({ value: { item: data } });
    expect(receiver.values).toHaveLength(1);
    for (const value of [false, 0, null, undefined]) {
        region.update({ value: { item: value } });
    }
    expect(receiver.values).toEqual([data, false, 0, null, undefined]);
    expect(host.firstElementChild).toBe(receiver);
});

test("a disposed binding does not deliver a queued value after a late custom-element definition", async () => {
    const { region } = mount('<test-late-value cms-bind-value="item"></test-late-value>', { item: 42 });
    region.unmount();
    const values: unknown[] = [];
    customElements.define(
        "test-late-value",
        class extends HTMLElement {
            setBindingValue(value: unknown): void {
                values.push(value);
            }
        },
    );
    await Promise.resolve();
    expect(values).toEqual([]);
});

test("native elements and nested source contents are not typed binding receivers", () => {
    const { host } = mount(
        '<div cms-bind-value="item"></div><section cms-source="/other"><test-value-receiver cms-bind-value="item"></test-value-receiver></section>',
        { item: 42 },
    );
    expect((host.querySelector("test-value-receiver") as ValueReceiver).values).toEqual([]);
    expect(host.querySelector("div")!.textContent).toBe("");
});
