type SourceRecord = Record<string, unknown>;

export type ValuationProduct = {
    id: string;
    title: string;
    description: string;
    metadata: SourceRecord;
};

export function readProducts(body: unknown): ValuationProduct[] {
    if (!isRecord(body) || !Array.isArray(body.items)) {
        return [];
    }
    return body.items.flatMap((item) => {
        if (!isRecord(item) || item.id == null) {
            return [];
        }
        return [
            {
                id: String(item.id),
                title: String(item.title ?? "").trim(),
                description: String(item.description ?? "").trim(),
                metadata: isRecord(item.metadata) ? item.metadata : {},
            },
        ];
    });
}

export function productValuation(
    metadata: unknown,
    minimumField: string,
    maximumField: string,
): { minimum: number; maximum: number } | null {
    if (!isRecord(metadata)) {
        return null;
    }
    const minimum = metadataNumber(metadata[minimumField]);
    const maximum = metadataNumber(metadata[maximumField]);
    if (minimum === null || maximum === null || minimum < 0 || maximum < minimum) {
        return null;
    }
    return { minimum, maximum };
}

export function valuationMoney(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(Math.round(amount));
}

function metadataNumber(value: unknown): number | null {
    if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is SourceRecord {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
