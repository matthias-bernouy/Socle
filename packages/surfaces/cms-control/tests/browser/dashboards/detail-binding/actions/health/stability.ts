import type { Locator } from "playwright";

/** Include slot-assigned ancestors, which own the admin shell's actual scroll containers. */
export function healthPosition(control: Locator) {
    return control.evaluate((node: HTMLElement) => {
        const scrolls: Array<[string, number, number]> = [];
        const visited = new Set<Element>();
        for (let current: Element | null = node; current && !visited.has(current); ) {
            visited.add(current);
            scrolls.push([current.localName, current.scrollTop, current.scrollLeft]);
            current =
                current.assignedSlot ?? current.parentElement ?? (current.getRootNode() as ShadowRoot).host ?? null;
        }
        const box = node.getBoundingClientRect();
        return {
            scrolls,
            window: [scrollX, scrollY],
            box: [box.x, box.y, box.width, box.height],
            focus: node.matches(":focus"),
        };
    });
}
