import aside from "./aside.html" with { type: "text" };
import condition from "./condition.html" with { type: "text" };
import event from "./event.html" with { type: "text" };
import fn from "./function.html" with { type: "text" };

const templateHtml = [event, condition, fn, aside].join("");

export function appendCreateTemplate(shell: HTMLElement): void {
    const template = document.createElement("template");
    template.innerHTML = templateHtml as unknown as string;
    const body = document.createElement("cms-shell-detail-body");
    body.slot = "body";
    for (const child of Array.from(template.content.children)) {
        (child.slot === "main" || child.slot === "aside" ? body : shell).append(child);
    }
    shell.append(body);
}
