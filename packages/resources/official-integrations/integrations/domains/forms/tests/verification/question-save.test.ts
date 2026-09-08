import { expect, test } from "bun:test";
import { handleFormsRequest } from "../../connectors/supabase/functions/cms-forms/handler";
import { questionReference, sectionReference } from "../../connectors/supabase/functions/cms-forms/builder/references";
import { adminRequest, managed, useAdminFixture } from "../fixtures/admin";
useAdminFixture();

test("renaming an existing question preserves its reference for read, reorder, repeated save and delete", async () => {
    const definition = managed.draftDefinition as any;
    const section = definition.steps[0];
    const question = section.fields[0];
    const ref = questionReference(String(managed.key), section.id, question.key);
    const context = sectionReference(String(managed.key), section.id);
    for (const key of ["renamedQuestion", "renamedAgain"]) {
        const result = await handleFormsRequest(
            adminRequest("/admin/form/question", {
                ref,
                key,
                label: "Renamed question",
                type: "text",
                required: false,
            }),
        );
        expect(result.status).toBe(200);
        expect(await result.json()).toMatchObject({ ref, key, required: false });
        const read = await handleFormsRequest(adminRequest(`/admin/form/question?ref=${ref}`));
        expect(read.status).toBe(200);
        expect(await read.json()).toMatchObject({ ref, key });
    }
    const list = await handleFormsRequest(adminRequest(`/admin/form/questions?context=${context}`));
    const refs = (await list.json()).items.map((item: any) => item.id).reverse();
    const order = await handleFormsRequest(adminRequest("/admin/form/questions/reorder", { context, refs }));
    expect(order.status).toBe(200);
    expect((await order.json()).items.map((item: any) => item.id)).toEqual(refs);
    const removed = await handleFormsRequest(adminRequest("/admin/form/question/delete", { ref }));
    expect(removed.status).toBe(200);
    const missing = await handleFormsRequest(adminRequest(`/admin/form/question?ref=${ref}`));
    expect(missing.status).toBe(404);
});

test("native question payloads preserve false booleans and reject empty choices without writing", async () => {
    const section = (managed.draftDefinition as any).steps[0];
    const ref = questionReference(String(managed.key), section.id, section.fields[0].key);
    const body = {
        ref,
        key: "format",
        label: "Format",
        type: "choice",
        required: false,
        multiple: false,
        presentation: "chips",
        options: [{ key: "first", label: "First" }],
    };
    const saved = await handleFormsRequest(adminRequest("/admin/form/question", body));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
        ref,
        required: false,
        multiple: false,
        options: [{ key: "first", label: "First" }],
    });
    const snapshot = structuredClone(managed.draftDefinition);
    const empty = await handleFormsRequest(adminRequest("/admin/form/question", { ...body, options: [] }));
    expect(empty.status).toBe(422);
    expect(managed.draftDefinition).toEqual(snapshot);
    const image = await handleFormsRequest(
        adminRequest("/admin/form/question", {
            ...body,
            presentation: "image-grid",
            imageOptions: [{ key: "first", label: "First", image: { id: "101", url: "/image", alt: "Alternative" } }],
        }),
    );
    expect(image.status).toBe(200);
    expect(await image.json()).toMatchObject({ options: [{ image: { mediaId: "101", alt: "Alternative" } }] });
    const text = await handleFormsRequest(
        adminRequest("/admin/form/question", { ref, key: "format", label: "Format", type: "text", required: false }),
    );
    expect(text.status).toBe(200);
    expect(await text.json()).toMatchObject({ ref, options: [], multiple: false });
});
