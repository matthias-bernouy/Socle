/** Native constraint validation ignores hidden inputs, including technical required fields. */
export function hasMissingTechnicalFields(form: HTMLFormElement): boolean {
    return Array.from(form.querySelectorAll<HTMLInputElement>('input[type="hidden"][required]')).some((input) => {
        if (!input.value || input.value.includes("{{")) {
            return true;
        }
        const type = input.getAttribute("cms-form-value-type");
        return type === "number"
            ? !input.value.trim() || !Number.isFinite(Number(input.value))
            : type === "boolean" && !["true", "false"].includes(input.value);
    });
}
