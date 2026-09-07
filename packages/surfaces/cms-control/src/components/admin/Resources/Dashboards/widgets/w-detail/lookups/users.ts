import template from "cms-control/static/admin/_content/sources/_runtime/detail/users.html" with { type: "text" };
import "./Directory";

export function directoryElement(): HTMLElement {
    return declaration("source");
}
export function composeUserOptions(control: HTMLElement, id: string): void {
    const option = declaration("option");
    option.setAttribute("cms-repeat", `detailUsersOptions.${id} as cmsUserOption`);
    control.setAttribute("cms-bind-boolean-invalid", "detailUsersFailed");
    control.setAttribute("hint", "{{ detailUsersHint }}");
    control.setAttribute("hint-level", "error");
    control.setAttribute("placeholder", "");
    control.append(option);
}
function declaration(kind: string): HTMLElement {
    const host = document.createElement("template");
    host.innerHTML = template as unknown as string;
    return host.content
        .querySelector<HTMLTemplateElement>(`[data-users="${kind}"]`)!
        .content.firstElementChild!.cloneNode(true) as HTMLElement;
}
