import { describe, expect, test } from "bun:test";
import { handleFormsRequest } from "../connectors/supabase/functions/cms-forms/handler";
import { adminRequest, response, managed, useAdminFixture } from "./fixtures/admin";
useAdminFixture();

describe("Forms admin workflows", () => {
    test("builds sections and questions without exposing JSON", async () => {
        const forms = await handleFormsRequest(adminRequest("/admin/forms?limit=50"));
        expect(forms.status).toBe(200);

        const sections = await handleFormsRequest(adminRequest("/admin/form/sections?context=event-registration"));
        expect(sections.status).toBe(200);
        const sectionList = (await sections.json()) as { items: Array<{ id: string }> };
        expect(sectionList.items.length).toBe(4);

        const createdSection = await handleFormsRequest(
            adminRequest("/admin/form/sections/create", { context: "event-registration" }),
        );
        const section = (await createdSection.json()) as { ref: string };
        expect(createdSection.status).toBe(200);

        const createdQuestion = await handleFormsRequest(
            adminRequest("/admin/form/questions/create", { context: section.ref }),
        );
        const question = (await createdQuestion.json()) as { ref: string };
        const savedQuestion = await handleFormsRequest(
            adminRequest("/admin/form/question", {
                ref: question.ref,
                key: "preferredFormat",
                label: "Preferred format",
                type: "choice",
                required: true,
                multiple: false,
                presentation: "image-grid",
                imageOptions: [
                    {
                        id: "inside",
                        key: "inside",
                        label: "In person",
                        image: {
                            id: "101",
                            url: "/.cms/sources/forms/choiceImage?id=101",
                            alt: "In-person session",
                        },
                        position: 0,
                    },
                    {
                        id: "terrace",
                        key: "remote",
                        label: "Remote",
                        image: { id: "102", url: "/.cms/sources/forms/choiceImage?id=102" },
                        position: 1,
                    },
                ],
            }),
        );
        expect(savedQuestion.status).toBe(200);
        const savedQuestionBody = (await savedQuestion.json()) as Record<string, unknown>;
        expect(savedQuestionBody).toMatchObject({
            key: "preferredFormat",
            label: "Preferred format",
            type: "choice",
            presentation: "image-grid",
            options: [
                { key: "inside", label: "In person", image: { mediaId: "101", alt: "In-person session" } },
                { key: "remote", label: "Remote", image: { mediaId: "102" } },
            ],
        });
        const duplicateKey = await handleFormsRequest(
            adminRequest("/admin/form/question", {
                ref: savedQuestionBody.ref,
                key: "session",
                label: "Preferred format",
                type: "choice",
                presentation: "image-grid",
                imageOptions: [{ key: "inside", label: "Inside", image: { id: "101" } }],
            }),
        );
        expect(duplicateKey.status).toBe(422);
        expect(JSON.stringify(managed)).not.toContain("definitionJson");
    });

    test("settings save sends only metadata and server defaults to its atomic operation", async () => {
        const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
        globalThis.fetch = async (input, init) => {
            calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
            return response(managed);
        };
        const defaults = await handleFormsRequest(adminRequest("/admin/form"));
        expect(await defaults.json()).toMatchObject({ id: null, key: "", accessMode: "public" });
        expect(calls).toHaveLength(0);
        for (const identity of [{ key: "new-form" }, { id: 1 }]) {
            const result = await handleFormsRequest(
                adminRequest("/admin/form/draft", {
                    ...identity,
                    title: " Updated title ",
                    description: "",
                    accessMode: "authenticated",
                }),
            );
            expect(result.status).toBe(200);
            expect(calls.at(-1)).toMatchObject({
                url: "https://database.example.test/rest/v1/rpc/save_form_settings",
                body: {
                    p_title: "Updated title",
                    p_description: null,
                    p_access_mode: "authenticated",
                    p_actor_id: "admin-1",
                },
            });
            expect(calls.at(-1)!.body).not.toHaveProperty("p_definition");
        }
        expect(calls[0]!.body).toMatchObject({ p_form_id: null, p_form_key: "new-form" });
        expect(calls[1]!.body).toMatchObject({ p_form_id: 1, p_form_key: null });
        for (const patch of [{ definition: {} }, { id: "1" }, { accessMode: "private" }, { title: "" }]) {
            const result = await handleFormsRequest(
                adminRequest("/admin/form/draft", {
                    id: 1,
                    title: "Title",
                    accessMode: "public",
                    ...patch,
                }),
            );
            expect(result.status).toBe(422);
        }
        expect(calls).toHaveLength(2);
    });

    test("shows versioned answers and updates the submission status", async () => {
        const detail = await handleFormsRequest(adminRequest("/admin/submission?id=42"));
        expect(detail.status).toBe(200);
        const resource = (await detail.json()) as Record<string, unknown>;
        expect(resource).not.toHaveProperty("definition");
        expect(resource.answers).toContainEqual({
            key: "attendeeName",
            section: "Contact details",
            question: "Your name",
            answer: "Alex Morgan",
        });
        expect(resource.answers).toContainEqual({
            key: "consent",
            section: "Review your registration",
            question: "I confirm that these registration details are accurate.",
            answer: "Yes",
        });
        expect(resource.answers).toContainEqual({
            key: "session",
            section: "Event preferences",
            question: "Preferred session",
            answer: "Afternoon",
        });

        const updated = await handleFormsRequest(
            adminRequest("/admin/submission/status", { id: 42, status: "reviewed" }),
        );
        expect(updated.status).toBe(200);
        expect(await updated.json()).toMatchObject({ id: 42, status: "reviewed" });
    });
});
