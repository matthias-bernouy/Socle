import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { setup, upload } from "./fixture";

for (const width of [1440, 390]) {
    test(`media additions keep their header and existing image nodes stable at ${width}px`, async () => {
        const browser = await chromium.launch();
        try {
            for (const initial of [0, 1]) {
                const page = await browser.newPage({ viewport: { width, height: 1000 } });
                page.setDefaultTimeout(6000);
                const { state, media, hold } = await setup(page);
                if (initial) {
                    state.current.media = [{ media: { id: 11, alt: "Original image" } }];
                    await page.reload();
                    await media.locator('[data-media-id="11"] img').waitFor();
                }
                const release = hold();
                await media.getByRole("button", { name: "Add media", exact: true }).scrollIntoViewIfNeeded();
                const original = initial ? await media.locator('[data-media-id="11"] img').elementHandle() : null;
                const reads = state.reads;
                const before = await media.evaluate((host) => {
                    const label = host.shadowRoot!.querySelector(".label-row")!;
                    const grid = host.shadowRoot!.querySelector(".media-grid")!;
                    const sample = () => ({
                        height: label.getBoundingClientRect().height,
                        gridY: grid.getBoundingClientRect().y,
                        gridHeight: grid.getBoundingClientRect().height,
                    });
                    const recorder = { frames: [sample()], running: true };
                    (host as any).mediaLayoutAudit = recorder;
                    const record = () => {
                        recorder.frames.push(sample());
                        if (recorder.running) {
                            requestAnimationFrame(record);
                        }
                    };
                    requestAnimationFrame(record);
                    return sample();
                });
                await upload(page, media);
                const pending = media.locator("[data-pending]");
                await pending.waitFor();
                const tile = await pending.elementHandle();
                const image = await pending.locator("img").elementHandle();
                await page.screenshot({ path: `/tmp/cmscore-media-${width}-${initial}-pending.png` });
                release();
                await media.locator('[data-media-id="81"]:not([data-pending])').waitFor();
                await page.screenshot({ path: `/tmp/cmscore-media-${width}-${initial}-complete.png` });
                expect(await tile!.evaluate((node) => node.isConnected)).toBe(true);
                expect(await image!.evaluate((node) => node.isConnected)).toBe(true);
                if (original) {
                    expect(await original.evaluate((node) => node.isConnected)).toBe(true);
                }
                const frames = await media.evaluate((host) => {
                    (host as any).mediaLayoutAudit.running = false;
                    return (host as any).mediaLayoutAudit.frames as Array<{
                        height: number;
                        gridY: number;
                        gridHeight: number;
                    }>;
                });
                expect(frames.length).toBeGreaterThan(2);
                for (const frame of frames) {
                    expect(frame.height).toBe(before.height);
                    expect(frame.gridY).toBe(before.gridY);
                    if (width === 390 || initial) {
                        expect(Math.abs(frame.gridHeight - before.gridHeight)).toBeLessThan(1);
                    }
                }
                expect(state.reads).toBe(reads);
                expect(state.writes).toHaveLength(0);
                expect(state.errors).toEqual([]);
                await page.close();
            }
        } finally {
            await browser.close();
        }
    }, 25000);
}
