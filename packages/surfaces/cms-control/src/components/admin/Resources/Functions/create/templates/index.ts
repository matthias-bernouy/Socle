import aside from "./aside.html" with { type: "text" };
import general from "./general.html" with { type: "text" };
import input from "./input.html" with { type: "text" };
import result from "./return.html" with { type: "text" };
import workflow from "./workflow.html" with { type: "text" };

const templateHtml = [general, input, workflow, result, aside].join("");

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
