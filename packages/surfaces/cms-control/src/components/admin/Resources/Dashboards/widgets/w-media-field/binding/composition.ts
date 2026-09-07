import type { DashboardField } from "@bernouy/cms-dashboards";
import template from "cms-control/static/admin/_content/sources/_runtime/detail/media.html" with { type: "text" };
import "./MediaField";
import "./parts/Tile";
import "./parts/Thumbnail";

export function composeMedia(
    control: HTMLElement,
    field: { id: string; multiple?: boolean; persist?: "save" },
    path = `detailMedia.${field.id}`,
): void {
    const declarations = document.createElement("template");
    declarations.innerHTML = template as unknown as string;
    const part = (kind: string) =>
        declarations.content
            .querySelector<HTMLTemplateElement>(`[data-media="${kind}"]`)!
            .content.firstElementChild!.cloneNode(true) as HTMLElement;
    const tile = part("tile");
    tile.setAttribute("cms-repeat", `${path}.items as media`);
    const add = part("add");
    add.setAttribute("cms-condition", `${path}.showAdd`);
    const image = part("image");
    image.setAttribute("cms-condition", `${path}.open`);
    image.setAttribute("data-cms-src", `{{ ${path}.preview.url }}`);
    image.setAttribute("alt", `{{ ${path}.preview.previewAlt }}`);
    const caption = part("caption");
    caption.textContent = `{{ ${path}.preview.title }}`;
    const counter = part("counter");
    counter.textContent = `{{ ${path}.counter }}`;
    const thumbnail = part("thumbnail");
    thumbnail.setAttribute("cms-repeat", `${path}.items as media`);
    thumbnail.setAttribute("selected-index", `{{ ${path}.index }}`);
    control.setAttribute("count", `{{ ${path}.items.length }}`);
    control.toggleAttribute("multiple", field.multiple === true);
    control.toggleAttribute("persist-on-save", field.persist === "save");
    control.append(tile, add, image, caption, counter, thumbnail);
}
