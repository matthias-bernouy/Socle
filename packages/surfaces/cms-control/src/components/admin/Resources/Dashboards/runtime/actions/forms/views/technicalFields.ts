import { showToast } from "@bernouy/components";

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

export function guardTechnicalFields(host: HTMLElement, formId: string): void {
    host.addEventListener(
        "submit",
        (event) => {
            if (
                (event.target as Element).getAttribute("id") !== formId ||
                !hasMissingTechnicalFields(event.target as HTMLFormElement)
            ) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            showToast("The operation identity or revision is missing. Reload the detail.", { type: "error" });
        },
        true,
    );
}
