import { sourceTrigger } from "./sourceEvents";

/** Values belong to source instances, including values supplied by completed actions. */
type SourceValue = { value: unknown };
const values = new WeakMap<Element, SourceValue>();
const receivers = new WeakMap<Element, (value: unknown) => void>();

export function readSourceData(source: Element): unknown {
    return values.get(source)?.value;
}

/** Seed before activation, or update the existing source without another request. */
export function setSourceData(source: Element, value: unknown): void {
    if (sourceTrigger(source) !== "auto") {
        throw new Error("setSourceData requires an automatic read source; form sources own their submission results.");
    }
    values.set(source, { value });
    receivers.get(source)?.(value);
}

export function rememberSourceData(source: Element, value: unknown): void {
    values.set(source, { value });
}

export function connectSourceData(source: Element, apply: (value: unknown) => void): { value: unknown } | undefined {
    receivers.set(source, apply);
    return values.get(source);
}

export function disconnectSourceData(source: Element): void {
    receivers.delete(source);
    values.delete(source);
}
