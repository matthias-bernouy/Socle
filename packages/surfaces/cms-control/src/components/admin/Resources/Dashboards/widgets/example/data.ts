import type { WDetailFieldValue } from "../w-detail/types";
import type { DashboardMediaItem } from "../w-media-field/types";

export type ExampleProduct = {
    id: string;
    title: string;
    status: string;
    vendor: string;
    category: string;
    description: string;
    media: DashboardMediaItem[];
    tags: string[];
    visibility: string;
    updated: string;
};

export const PRODUCTS: ExampleProduct[] = [
    product("prod_1001", "Desk Lamp", "Active", "Northwind", "Home", "Online store", "Today"),
    product("prod_1002", "Canvas Backpack", "Draft", "Acme", "Travel", "Hidden", "Yesterday"),
    product("prod_1003", "Ceramic Mug", "Active", "Example Supply", "Kitchen", "Online store", "Jul 1"),
    product("prod_1004", "Notebook Set", "Archived", "Paper & Co.", "Stationery", "Hidden", "Jun 28"),
];

export function isStringArray(value: WDetailFieldValue): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isMediaItems(value: WDetailFieldValue): value is DashboardMediaItem[] {
    return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "url" in item);
}

function product(
    id: string,
    title: string,
    status: string,
    vendor: string,
    category: string,
    visibility: string,
    updated: string,
): ExampleProduct {
    return {
        id,
        title,
        status,
        vendor,
        category,
        visibility,
        updated,
        description: "Editable sandbox content before any data source is wired.",
        media: media(id, title),
        tags: ["Featured", "New"],
    };
}

function media(id: string, title: string): DashboardMediaItem[] {
    return [
        {
            id: `${id}_media_1`,
            url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=420&q=80",
            alt: `${title} media`,
        },
    ];
}
