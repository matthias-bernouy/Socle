import { valueAt } from "../../../runtime/expressions";

/** Projects only the draft order; the read source retains the server snapshot. */
export function orderedItems(data: unknown, host: HTMLElement, order: string[] | null): unknown[] {
    const path = host.getAttribute("order-items-path");
    const value = path ? valueAt(data, path) : data;
    const items: unknown[] = Array.isArray(value) ? value : [];
    if (!order) {
        return items;
    }
    const key = host.getAttribute("order-row-key")!;
    const byId = new Map(items.map((item) => [String(valueAt(item, key)), item]));
    const ordered = order.flatMap((id) => (byId.has(id) ? [byId.get(id)] : []));
    const known = new Set(order);
    return [...ordered, ...items.filter((item) => !known.has(String(valueAt(item, key))))];
}
