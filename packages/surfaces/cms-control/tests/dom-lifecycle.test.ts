import { expect, test } from "bun:test";

test("the DOM simulator delivers mutations after garbage collection and stops after disconnect", async () => {
    const node = document.createElement("div");
    const observer = new MutationObserver(() => {});
    observer.observe(node, { attributes: true });
    try {
        node.setAttribute("cms-source", "/first");
        expect(observer.takeRecords()).toHaveLength(1);
        await new Promise((resolve) => setTimeout(resolve, 0));
        Bun.gc(true);
        node.setAttribute("cms-source", "/second");
        expect(observer.takeRecords()).toHaveLength(1);
        observer.disconnect();
        node.setAttribute("cms-source", "/third");
        expect(observer.takeRecords()).toHaveLength(0);
    } finally {
        observer.disconnect();
    }
});
