import { expect, test } from "bun:test";
import { mediaContext } from "cms-control/components/admin/Resources/Dashboards/widgets/w-media-field/binding/context";

test("media projection preserves staging identity without retaining obsolete preview fields or mutating the draft", () => {
    const owner = document.createElement("div");
    const project = mediaContext(owner, [
        {
            id: "photos",
            path: "photos",
            label: "Images",
            type: "media",
            item: { idPath: "id", urlPath: "url" },
        },
    ]);
    const pending = Object.freeze({
        id: "local-1",
        url: "blob:test",
        pending: true,
        name: "Upload",
        thumbnailUrl: "blob:thumb",
    });
    const first = project({ photos: [pending] }, { photos: [pending] }).photos!.items[0]!;
    const uploaded = Object.freeze({ id: "81", url: "blob:test" });
    const second = project({ photos: [uploaded] }, { photos: [uploaded] }).photos!.items[0]!;
    expect(second).toBe(first);
    expect(second).toMatchObject({ id: "81", thumbnail: "blob:test", title: "Image 1", previewAlt: "Image 1" });
    expect(second.pending).toBeUndefined();
    expect(second.name).toBeUndefined();
    expect(second.thumbnailUrl).toBeUndefined();
    expect(pending.id).toBe("local-1");
    expect(pending.pending).toBe(true);
    const unrelated = { id: "82", url: "blob:test" };
    expect(project({ photos: [unrelated] }, { photos: [unrelated] }).photos!.items[0]).not.toBe(second);
});
