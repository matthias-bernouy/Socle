import type { DashboardMediaItem } from "../w-media-field/types";

type MediaControl = HTMLElement & { items: DashboardMediaItem[] };

export function isMediaControl(control: HTMLElement): control is MediaControl {
    return "items" in control && Array.isArray((control as MediaControl).items);
}
