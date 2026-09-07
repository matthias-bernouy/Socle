/** Required nested controls use the same visible errors as ordinary detail fields. */
export function validateReorderable(control: HTMLElement, markedOnly = false): HTMLElement | null {
    let invalid: HTMLElement | null = null;
    for (const editor of Array.from(control.querySelectorAll<HTMLElement>("[data-item-field][required]"))) {
        if (markedOnly && !editor.hasAttribute("data-choice-required-invalid")) {
            continue;
        }
        const missing =
            editor instanceof HTMLInputElement && editor.type === "checkbox"
                ? !editor.checked
                : "items" in editor && Array.isArray(editor.items)
                  ? editor.items.length === 0
                  : !("value" in editor) || String(editor.value ?? "").trim() === "";
        if (missing) {
            editor.setAttribute("data-choice-required-invalid", "");
            editor.setAttribute("invalid", "");
            editor.setAttribute("aria-invalid", "true");
            editor.setAttribute("hint", "This field is required.");
            editor.setAttribute("hint-level", "error");
            invalid ??= editor;
        } else if (editor.hasAttribute("data-choice-required-invalid")) {
            for (const attribute of ["data-choice-required-invalid", "invalid", "aria-invalid", "hint", "hint-level"]) {
                editor.removeAttribute(attribute);
            }
        }
    }
    if (invalid && !markedOnly) {
        const details = invalid.closest("cms-dashboard-reorderable-settings")?.shadowRoot?.querySelector("details");
        if (details) {
            details.open = true;
        }
    }
    return invalid;
}
