/** Keep edits made after submission; field values use the JSON action contract. */
export function remainingDraft(
    draft: Record<string, unknown>,
    submitted: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(draft).filter(
            ([key, value]) =>
                !Object.hasOwn(submitted, key) || JSON.stringify(value) !== JSON.stringify(submitted[key]),
        ),
    );
}
