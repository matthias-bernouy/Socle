import { HttpError } from "../../core/errors.ts";
import { one } from "../../core/rest.ts";
import type { JsonRecord } from "../../core/types.ts";

export function newSellerOffer(): JsonRecord {
    return {
        id: null,
        productId: null,
        variantId: null,
        slug: "",
        title: "",
        description: "",
        conditionCode: "good",
        publicationStatus: "draft",
        workflowState: "draft",
        acceptedPriceAmount: null,
        currency: "eur",
        availability: "available",
        quantityAvailable: null,
        metadata: {},
        media: [],
        mainImageMediaId: null,
        version: 1,
    };
}

export async function newOffer(): Promise<JsonRecord> {
    const settings = await one("settings", { id: "default" }, "default_currency,whole_unit_prices");
    if (!settings) {
        throw new HttpError(500, "commerce settings are missing");
    }
    return {
        ...newSellerOffer(),
        sellerId: null,
        currency: settings.default_currency,
        wholeUnitPrices: settings.whole_unit_prices,
        version: null,
        seller: null,
        product: null,
        variant: null,
        priceRule: null,
        priceProposals: [],
        creationToken: crypto.randomUUID(),
    };
}
