import { IntegrationInputError } from "../../../errors";
import type { IntegrationUiDefinition } from "../../../../interfaces/Integration";

type UiReadMode = "throw" | "drop";

export function parseUiDefinition(value: unknown, name = "definition.ui"): IntegrationUiDefinition | undefined {
    return readUiDefinition(value, name, "throw");
}

export function sanitizeUiDefinition(value: unknown): IntegrationUiDefinition | undefined {
    return readUiDefinition(value, "ui", "drop");
}

function readUiDefinition(value: unknown, name: string, mode: UiReadMode): IntegrationUiDefinition | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (!isRecord(value)) {
        return invalid(mode, name, "must be an object");
    }

    if (value.instructions === undefined) {
        return {};
    }
    const instructions = pairList(value.instructions, `${name}.instructions`, mode);
    return instructions ? { instructions } : {};
}

function pairList(value: unknown, name: string, mode: UiReadMode): Array<[string, string]> | undefined {
    if (!Array.isArray(value)) {
        return invalid(mode, name, "must be an array");
    }
    const out: Array<[string, string]> = [];
    for (const [index, entry] of value.entries()) {
        if (!Array.isArray(entry) || entry.length !== 2) {
            return invalid(mode, `${name}.${index}`, "must be a string pair");
        }
        const first = text(entry[0]);
        const second = text(entry[1]);
        if (!first || !second) {
            return invalid(mode, `${name}.${index}`, "must contain two non-empty strings");
        }
        out.push([first, second]);
    }
    return out;
}

function invalid(mode: UiReadMode, name: string, message: string): undefined {
    if (mode === "throw") {
        throw new IntegrationInputError(name, message);
    }
    return undefined;
}

function text(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
