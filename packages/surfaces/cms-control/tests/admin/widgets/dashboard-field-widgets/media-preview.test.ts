import { afterEach, describe, expect, test } from "bun:test";
import {
    createResponsiveSourceImageBrowserApi,
    installBoundImageRuntime,
    type BoundImageRuntime,
} from "@bernouy/cms-source-images/browser-host";
import type { DashboardMediaField } from "cms-control/components/admin/Resources/Dashboards/widgets/w-media-field/binding/MediaField";
import { mountDetailFields } from "../../dashboards/detail/boundDetail";
import { waitForDetail } from "../../dashboards/detail/detailTestHelpers";
let imageRuntime: BoundImageRuntime | undefined;
import {
    W_MEDIA_FIELD_ACTION_EVENT,
    type DashboardMediaItem,
} from "../../../../src/components/admin/Resources/Dashboards/widgets/w-media-field/types";

const items: DashboardMediaItem[] = [
    {
        id: "first",
        url: "/media/first.jpg",
        thumbnailUrl: "/thumbnails/first.avif",
        alt: "Front view",
        name: "First racket",
    },
    {
        id: "second",
        url: "/media/second.jpg",
        thumbnailUrl: "/thumbnails/second.avif",
        alt: "Side view",
        name: "Second racket",
    },
];

afterEach(() => {
    imageRuntime?.disconnect();
    document.body.replaceChildren();
});

describe("dashboard media field preview", () => {
    test("opens originals and navigates without entering the edit flow", async () => {
        const { field } = await createField(items);
        const root = field.shadowRoot!;
        const trigger = root.querySelector<HTMLButtonElement>("[data-preview-open]")!;
        const fileInput = root.querySelector<HTMLInputElement>("[data-file]")!;
        let pickerClicks = 0;
        let mediaActions = 0;
        fileInput.click = () => {
            pickerClicks += 1;
        };
        field.addEventListener(W_MEDIA_FIELD_ACTION_EVENT, () => {
            mediaActions += 1;
        });

        trigger.focus();
        trigger.click();
        await waitForDetail(() => Boolean(field.querySelector<HTMLImageElement>("[data-preview-image]")?.src));

        const dialog = root.querySelector<HTMLDialogElement>("[data-preview-dialog]")!;
        const previewImage = field.querySelector<HTMLImageElement>("[data-preview-image]")!;
        expect(dialog.open).toBe(true);
        expect(previewImage.src.endsWith("/media/first.jpg")).toBe(true);
        expect(field.querySelector("[slot=caption]")?.textContent).toBe("First racket");
        expect(field.querySelector("[slot=counter]")?.textContent).toBe("1 / 2");
        expect(root.activeElement).toBe(root.querySelector("[data-preview-action='close']"));
        expect(
            field
                .querySelector<HTMLImageElement>("cms-dashboard-media-thumbnail img")
                ?.src.endsWith("/thumbnails/first.avif"),
        ).toBe(true);
        expect(field.querySelectorAll("img[src$='/media/second.jpg']")).toHaveLength(0);

        root.querySelector<HTMLButtonElement>("[data-preview-action='next']")!.click();
        await waitForDetail(() => previewImage.src.endsWith("/media/second.jpg"));
        expect(previewImage.src.endsWith("/media/second.jpg")).toBe(true);
        expect(field.querySelector("[slot=counter]")?.textContent).toBe("2 / 2");
        expect(thumbnail(field, 1)?.getAttribute("aria-current")).toBe("true");

        const firstThumbnail = thumbnail(field, 0)!;
        firstThumbnail.click();
        await waitForDetail(() => previewImage.src.endsWith("/media/first.jpg"));
        expect(previewImage.src.endsWith("/media/first.jpg")).toBe(true);
        expect(thumbnail(field, 0).getRootNode()).toHaveProperty("activeElement", thumbnail(field, 0));
        dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
        await waitForDetail(() => previewImage.src.endsWith("/media/second.jpg"));
        expect(previewImage.src.endsWith("/media/second.jpg")).toBe(true);
        expect(thumbnail(field, 1).getRootNode()).toHaveProperty("activeElement", thumbnail(field, 1));
        // Happy DOM cannot read activeElement across sibling shadow roots.
        // Chromium E2E exercises End/Escape while the second thumbnail keeps focus.
        thumbnail(field, 1).blur();
        dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
        expect(previewImage.src.endsWith("/media/second.jpg")).toBe(true);

        dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        await waitForDetail(() => !dialog.open);
        await waitForDetail(() => !field.querySelector("[data-preview-image]"));
        expect(root.activeElement).toBe(trigger);
        expect(pickerClicks).toBe(0);
        expect(mediaActions).toBe(0);
    });

    test("tracks item changes and closes safely when the gallery becomes empty", async () => {
        const { field, detail } = await createField([]);
        const root = field.shadowRoot!;
        const trigger = root.querySelector<HTMLButtonElement>("[data-preview-open]")!;
        expect(trigger.hidden).toBe(true);
        expect(getComputedStyle(trigger).display).toBe("none");

        detail.applyFieldDraft("photos", [items[0]!]);
        await waitForDetail(() => !trigger.hidden);
        expect(trigger.hidden).toBe(false);
        trigger.click();
        await waitForDetail(() => Boolean(field.querySelector<HTMLImageElement>("[data-preview-image]")?.src));

        const dialog = root.querySelector<HTMLDialogElement>("[data-preview-dialog]")!;
        const previewImage = field.querySelector<HTMLImageElement>("[data-preview-image]")!;
        expect(dialog.open).toBe(true);
        expect(root.querySelector<HTMLButtonElement>("[data-preview-action='previous']")?.hidden).toBe(true);
        expect(root.querySelector<HTMLElement>("[data-preview-strip]")?.hidden).toBe(true);
        expect(getComputedStyle(root.querySelector<HTMLElement>(".preview-figure")!).gridColumn).toBe("2");
        expect(root.querySelector("[data-preview-status]")?.textContent).toBe("Loading image…");

        previewImage.dispatchEvent(new Event("error"));
        expect(root.querySelector("[data-preview-status]")?.textContent).toBe("Unable to load this image.");

        detail.applyFieldDraft("photos", [items[1]!]);
        await waitForDetail(() => previewImage.src.endsWith("/media/second.jpg"));
        expect(previewImage.src.endsWith("/media/second.jpg")).toBe(true);
        expect(field.querySelector("[slot=caption]")?.textContent).toBe("Second racket");
        expect(root.querySelector("[data-preview-status]")?.textContent).toBe("Loading image…");

        detail.applyFieldDraft("photos", []);
        await waitForDetail(() => !dialog.open);
        expect(dialog.open).toBe(false);
        expect(trigger.hidden).toBe(true);
        await waitForDetail(() => !field.querySelector("[data-preview-image]"));
    });

    test("closes from both explicit and backdrop controls", async () => {
        const { field } = await createField(items);
        const root = field.shadowRoot!;
        const trigger = root.querySelector<HTMLButtonElement>("[data-preview-open]")!;
        const dialog = root.querySelector<HTMLDialogElement>("[data-preview-dialog]")!;

        trigger.click();
        root.querySelector<HTMLButtonElement>("[data-preview-action='close']")!.click();
        expect(dialog.open).toBe(false);
        expect(root.activeElement).toBe(trigger);

        trigger.click();
        dialog.click();
        expect(dialog.open).toBe(false);
        expect(root.activeElement).toBe(trigger);
    });
});

async function createField(value: DashboardMediaItem[]) {
    imageRuntime = installBoundImageRuntime(
        document,
        createResponsiveSourceImageBrowserApi({ public: false, private: false }),
    );
    const detail = await mountDetailFields(
        [
            {
                type: "media",
                id: "photos",
                path: "photos",
                label: "Images",
                multiple: true,
                item: { idPath: "id", urlPath: "url", altPath: "alt" },
            },
        ],
        { photos: [] },
    );
    detail.applyFieldDraft("photos", value);
    const field = detail.querySelector<DashboardMediaField>("cms-dashboard-media-field")!;
    await waitForDetail(() => field.items.length === value.length);
    return { field, detail };
}

function thumbnail(field: HTMLElement, index: number): HTMLButtonElement {
    return field.querySelector(`cms-dashboard-media-thumbnail[index="${index}"]`)!.shadowRoot!.querySelector("button")!;
}
