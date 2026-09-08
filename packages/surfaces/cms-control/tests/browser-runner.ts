import { relative, resolve, sep } from "node:path";

const workspace = resolve(import.meta.dir, "../../../..");
const browser = resolve(import.meta.dir, "browser");
const filters = (process.argv.length > 2 ? process.argv.slice(2) : ["dashboards"]).map((value) =>
    resolve(browser, value),
);
if (filters.some((path) => path !== browser && !path.startsWith(browser + sep))) {
    throw new Error("Browser test paths must stay inside cms-control/tests/browser.");
}
const available = Array.from(new Bun.Glob("**/*.test.ts").scanSync({ cwd: browser, absolute: true })).sort();
for (const filter of filters) {
    if (!available.some((file) => file === filter || file.startsWith(filter + sep))) {
        throw new Error(`No browser tests matched ${relative(browser, filter)}.`);
    }
}
const files = available.filter((file) => filters.some((filter) => file === filter || file.startsWith(filter + sep)));
const failed: string[] = [];

// Each file owns its Bun/DOM globals and Playwright lifecycle. Never retry an assertion failure.
for (const file of files) {
    const name = relative(browser, file);
    const started = performance.now();
    const child = Bun.spawn([process.execPath, "test", file], {
        cwd: workspace,
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
    }, 90_000);
    const code = await child.exited;
    clearTimeout(timeout);
    const passed = code === 0 && !timedOut;
    if (!passed) {
        failed.push(name);
    }
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`[browser][${passed ? "PASS" : "FAIL"}] ${name} (${seconds}s${timedOut ? ", process timeout" : ""})`);
}
console.log(`[browser][SUMMARY] ${files.length - failed.length} files passed, ${failed.length} failed.`);
if (failed.length) {
    console.error(failed.join("\n"));
    process.exitCode = 1;
}
