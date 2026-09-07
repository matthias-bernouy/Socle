import { configureDetail, setSourceData, mountDetail } from "../../dashboards/detail/boundDetail";
import { afterEach, describe, expect, test } from "bun:test";
import { P9rInput, Button, Combobox, P9rSelect, TokenInput } from "@bernouy/components";
import "../../../../src/components/admin/Resources/Dashboards/widgets/w-detail/WDetail";

if (!customElements.get("p9r-input")) {
    customElements.define("p9r-input", P9rInput);
}
if (!customElements.get("p9r-button")) {
    customElements.define("p9r-button", Button);
}
if (!customElements.get("p9r-combobox")) {
    customElements.define("p9r-combobox", Combobox);
}
if (!customElements.get("p9r-select")) {
    customElements.define("p9r-select", P9rSelect);
}
if (!customElements.get("p9r-token-input")) {
    customElements.define("p9r-token-input", TokenInput);
}

const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch;
    document.body.replaceChildren();
});

describe("dashboard detail widget actions", () => {
    test("renders readonly arrays as compact lists", async () => {
        const detail = document.createElement("cms-dashboard-w-detail");
        configureDetail(detail, {
            widget: "w-detail",
            id: "connectAccountDetail",
            source: { endpoint: "getConnectAccount" },
            title: { path: "userId", fallback: "Connected account" },
            main: [
                {
                    id: "requirements",
                    title: "Requirements",
                    fields: [
                        { id: "currentlyDue", label: "Currently due", path: "currentlyDue", type: "readonly" },
                        {
                            id: "pendingVerification",
                            label: "Pending verification",
                            path: "pendingVerification",
                            type: "readonly",
                        },
                    ],
                },
            ],
        });
        setSourceData(detail, {
            userId: "seller-1",
            currentlyDue: ["business_profile.mcc", "individual.address.line1"],
            pendingVerification: [],
        });
        detail.setAttribute("data-row-key", "seller-1");

        await mountDetail(detail);
        await Promise.resolve();

        const lists = detail.querySelectorAll(".readonly-list");
        expect(lists).toHaveLength(1);
        expect(Array.from(lists[0]!.querySelectorAll("li")).map((item) => item.textContent)).toEqual([
            "business_profile.mcc",
            "individual.address.line1",
        ]);
        expect(detail.querySelector(".readonly-empty")?.textContent).toBe("None");
    });

    test("renders readonly image fields as an image preview", async () => {
        const detail = document.createElement("cms-dashboard-w-detail");
        configureDetail(detail, {
            widget: "w-detail",
            id: "userDetail",
            source: { endpoint: "user" },
            main: [
                {
                    id: "avatar",
                    title: "Avatar",
                    fields: [
                        {
                            id: "avatarPreview",
                            label: "Avatar",
                            path: "avatarUrl",
                            type: "readonly",
                            format: "image",
                        },
                    ],
                },
            ],
        });
        setSourceData(detail, { avatarUrl: "https://cdn.example.test/avatar.jpg" });
        await mountDetail(detail);
        await Promise.resolve();

        const image = detail.querySelector<HTMLImageElement>("img.detail-image");
        expect(image?.getAttribute("data-cms-src")).toBe("https://cdn.example.test/avatar.jpg");
        expect(image?.alt).toBe("Avatar");
    });
});
