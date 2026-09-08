import type { DashboardField } from "@bernouy/cms-dashboards";

type ReadonlyField = Extract<DashboardField, { type: "readonly" }>;

/** Only field definitions enter composition; binding applies all resource values. */
export function composeReadonly(control: HTMLElement, field: ReadonlyField, root: string): void {
    const path = field.path === "." ? root : `${root}.${field.path}`;
    if (field.format === "url") {
        const anchor = control.querySelector("a")!;
        anchor.setAttribute("href", fieldBinding(root, field.path, "dashboardHttpUrl"));
        anchor.setAttribute("cms-condition", `${path} | dashboardHttpUrl`);
        anchor.textContent = fieldBinding(root, field.path);
        const fallback = control.querySelector("span")!;
        fallback.setAttribute("cms-condition", `${path} | dashboardHttpUrl == ''`);
        fallback.textContent = fieldBinding(root, field.path);
    } else if (field.format === "image") {
        const image = control.querySelector("img")!;
        image.alt = field.label;
        image.setAttribute("cms-condition", `${path} | dashboardTrimmedText`);
        image.setAttribute("data-cms-src", fieldBinding(root, field.path, "dashboardTrimmedText"));
        control.querySelector("span")!.setAttribute("cms-condition", `!${path} | dashboardTrimmedText`);
    } else if (field.format === "money") {
        const sibling = field.path.includes(".")
            ? `${path.slice(0, path.lastIndexOf("."))}.currency`
            : `${root}.currency`;
        const value = control.querySelector("span")!;
        value.textContent = fieldBinding(root, field.path, `dashboardMoney(${sibling})`);
        if (sibling !== `${root}.currency`) {
            value.setAttribute("cms-condition", `${sibling} | dashboardDefined`);
            const fallback = value.cloneNode() as HTMLElement;
            fallback.setAttribute("cms-condition", `!${sibling} | dashboardDefined`);
            fallback.textContent = fieldBinding(root, field.path, `dashboardMoney(${root}.currency)`);
            control.append(fallback);
        }
    } else if (field.format === "date" || field.format === "badge") {
        control.querySelector("span")!.textContent = fieldBinding(
            root,
            field.path,
            field.format === "date" ? "dashboardDate" : "dashboardBadge",
        );
    } else {
        control
            .querySelector("[data-display-text]")!
            .setAttribute("cms-condition", `${path} | dashboardValueKind == 'scalar'`);
        control.querySelector("[data-display-text]")!.textContent = fieldBinding(root, field.path);
        control
            .querySelector("[data-display-empty]")!
            .setAttribute("cms-condition", `${path} | dashboardValueKind == 'empty-list'`);
        control.querySelector("ul")!.setAttribute("cms-condition", `${path} | dashboardValueKind == 'list'`);
        control.querySelector("li")!.setAttribute("cms-repeat", `${path} as readonlyItem`);
    }
}

export function fieldBinding(root: string, path: string, filter?: string): string {
    return `{{ ${path === "." ? root : `${root}.${path}`}${filter ? ` | ${filter}` : ""} }}`;
}
