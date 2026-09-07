import { prepare_bloc } from "@bernouy/cms-bloc-compile";
import { BINDING_CORE_TAG, BindingCore } from "@bernouy/components";
import { FsIntegrationDefinitionRepository } from "@bernouy/cms-integrations/fs";
import { OFFICIAL_INTEGRATIONS_ROOT } from "@bernouy/cms-official-integrations";

export const filterTag = "test-commerce-schema-offer-filter";
export const listTag = "test-commerce-schema-offer-list";

export function createBindingCore(disabled = false): BindingCore {
    if (!customElements.get(BINDING_CORE_TAG)) {
        customElements.define(BINDING_CORE_TAG, BindingCore);
    }
    const core = document.createElement(BINDING_CORE_TAG) as BindingCore;
    if (disabled) {
        core.setAttribute("cms-binding-disabled", "");
    }
    return core;
}

export async function defineFilter(): Promise<void> {
    installFilterSourceTransport();
    await defineCommerceBloc(filterTag, "mossa-commerce-offer-filter-controller");
}

export async function defineList(): Promise<void> {
    await defineCommerceBloc(listTag, "mossa-commerce-offer-list");
}

export function createFilter(): HTMLElement & { managedParams(): string[] } {
    const filter = document.createElement(filterTag) as HTMLElement & { managedParams(): string[] };
    const source = document.createElement("form");
    source.hidden = true;
    source.setAttribute("data-offer-filter-schema-source", "");
    source.setAttribute("cms-source", "/.cms/sources/commerce/offerFilterSchema");
    source.setAttribute("cms-source-trigger", "submit");
    source.setAttribute("cms-source-method", "GET");
    source.setAttribute("cms-source-inherit-query", "false");
    const category = document.createElement("input");
    category.type = "hidden";
    category.name = "category";
    category.setAttribute("data-schema-category-input", "");
    source.append(category);
    filter.append(source);
    return filter;
}

async function defineCommerceBloc(tag: string, artifactTag: string): Promise<void> {
    if (customElements.get(tag)) {
        return;
    }
    const definition = await new FsIntegrationDefinitionRepository(OFFICIAL_INTEGRATIONS_ROOT).get("mossa");
    const artifact = definition?.artifacts?.find(
        (candidate) => candidate.type === "bloc" && candidate.bloc.tag === artifactTag,
    );
    if (!artifact || artifact.type !== "bloc" || !artifact.bloc.viewJS) {
        throw new Error(`${artifactTag} source not found`);
    }
    const compiled = await prepare_bloc(
        new File([artifact.bloc.viewJS], "Bloc.ts", { type: "text/typescript" }),
        null,
        artifact.bloc.name,
        artifact.bloc.group ?? "Commerce",
        artifact.bloc.description ?? "",
        tag,
        artifact.bloc.source,
        undefined,
        { viewPath: artifact.bloc.view ?? "Bloc.ts" },
    );
    new Function(compiled.viewJS)();
}

let filterSourceTransportInstalled = false;

function installFilterSourceTransport(): void {
    if (filterSourceTransportInstalled) {
        return;
    }
    filterSourceTransportInstalled = true;
    document.addEventListener(
        "submit",
        (event) => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-offer-filter-schema-source")) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            void submitFilterSource(form);
        },
        true,
    );
}

async function submitFilterSource(form: HTMLFormElement): Promise<void> {
    const url = new URL(form.getAttribute("cms-source")!, document.baseURI);
    for (const input of form.querySelectorAll<HTMLInputElement>("input[name]")) {
        if (!input.disabled) {
            url.searchParams.append(input.name, input.value);
        }
    }
    try {
        const response = await globalThis.fetch(url, { method: "GET" });
        const body = await response.json().catch(() => null);
        form.dispatchEvent(
            new CustomEvent(response.ok ? "cms-source:success" : "cms-source:failed", {
                bubbles: true,
                detail: { body, status: response.status },
            }),
        );
    } catch (error) {
        form.dispatchEvent(new CustomEvent("cms-source:failed", { bubbles: true, detail: { error } }));
    }
}

export async function settleLifecycle(): Promise<void> {
    for (let pass = 0; pass < 4; pass++) {
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

export async function settleUntil(predicate: () => boolean, passes = 20): Promise<void> {
    for (let pass = 0; pass < passes; pass++) {
        if (predicate()) {
            return;
        }
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error("Timed out while settling the Commerce filter lifecycle");
}

export function captureSourceWrites(element: Element): string[] {
    const sources: string[] = [];
    const setAttribute = element.setAttribute.bind(element);
    element.setAttribute = ((name: string, value: string) => {
        if (name === "cms-source") {
            sources.push(value);
        }
        setAttribute(name, value);
    }) as typeof element.setAttribute;
    return sources;
}
