import { expect, test } from "bun:test";
import { DetailFieldState } from "../../../../src/components/admin/Resources/Dashboards/widgets/w-detail/runtime/fieldState";

test("rollback restores only the failed submitted field and preserves newer drafts", () => {
    const root = document.createElement("div").attachShadow({ mode: "open" });
    const fields = new DetailFieldState(
        root,
        () => null,
        () => ({ rowKey: "", eyebrow: "", title: "", main: [], aside: [], actions: [] }),
    );
    const previous = [{ id: "stored", url: "/stored.svg" }];
    const submitted = [...previous, { id: "temporary", url: "blob:temporary" }];
    fields.record("photos", submitted);
    fields.record("notes", "New unrelated draft");
    fields.restoreField("photos", structuredClone(submitted), previous);
    expect(fields.draft).toEqual({ photos: previous, notes: "New unrelated draft" });
    expect(fields.draft.photos).not.toBe(previous);

    const newer = [...submitted, { id: "newer", url: "blob:newer" }];
    fields.record("photos", newer);
    fields.restoreField("photos", submitted, previous);
    expect(fields.draft.photos).toBe(newer);
    fields.clear();
    fields.restoreField("photos", submitted, previous);
    expect(fields.draft).toEqual({});
});
