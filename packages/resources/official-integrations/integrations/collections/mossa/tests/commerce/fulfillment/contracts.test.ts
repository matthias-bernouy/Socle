import { describe, expect, test } from "bun:test";
import { createBloc, order, shipment, snapshot } from "./harness";

const readPath = "/.cms/sources/system-functions/getShipmentForMySale?orderId=42";
const createPath = "/.cms/sources/system-functions/createShipmentForMySale";
const handoffPath = "/.cms/sources/system-functions/declareShipmentHandoffForMySale";
const labelPath = "/.cms/sources/system-functions/requestShipmentLabelForMySale";

describe("seller fulfillment UI mutation contracts", () => {
    test("renders the shipment returned after label creation without changing the seller projection", async () => {
        const created = { ...shipment };
        const { bloc, calls } = await createBloc((call) => {
            if (call.path === readPath) {
                return { ...order, shipments: [] };
            }
            if (call.path === createPath) {
                return { ...order, shipment: created, fulfillment: { status: "label_ready" } };
            }
            throw new Error(`unexpected request ${call.method} ${call.path}`);
        });

        document.body.append(bloc);
        await waitFor(() => calls.length === 1);
        bloc.querySelector<HTMLButtonElement>("[data-create]")!.click();
        await waitFor(() => calls.length === 2 && snapshot(bloc).createHidden === true);

        expect(calls.map((call) => call.path)).toEqual([readPath, createPath]);
        expect(calls.find((call) => call.path === createPath)).toEqual({
            path: createPath,
            method: "POST",
            body: { orderId: "42" },
        });
        expect(snapshot(bloc)).toEqual({
            orderNumber: order.orderNumber,
            status: "Shipping label ready",
            expeditionNumber: shipment.expeditionNumber,
            latest: "The shipping label is available.",
            message: "",
            contentHidden: false,
            createHidden: true,
            handoffHidden: false,
            labelHidden: false,
            trackingHidden: false,
            trackingUrl: shipment.trackingUrl,
        });
    });

    test("renders a seller handoff and emits the existing fulfillment event", async () => {
        const declaredAt = "2026-07-20T10:00:00.000Z";
        const events: unknown[] = [];
        const { bloc, calls } = await createBloc((call) => {
            if (call.path === readPath) {
                return { ...order, shipments: [shipment] };
            }
            if (call.path === handoffPath) {
                return {
                    shipment: {
                        id: shipment.id,
                        externalOrderId: order.orderPublicId,
                        expeditionNumber: shipment.expeditionNumber,
                        status: shipment.status,
                        sellerHandoffDeclaredAt: declaredAt,
                    },
                    fulfillment: { status: "seller_handoff_declared" },
                };
            }
            throw new Error(`unexpected request ${call.method} ${call.path}`);
        });
        bloc.addEventListener("commerce-fulfillment:updated", (event) => {
            events.push((event as CustomEvent).detail);
        });

        document.body.append(bloc);
        await waitFor(() => calls.length === 1);
        bloc.querySelector<HTMLButtonElement>("[data-handoff]")!.click();
        await waitFor(() => calls.length === 2 && events.length === 1);

        expect(calls.map((call) => call.path)).toEqual([readPath, handoffPath]);
        expect(calls.find((call) => call.path === handoffPath)).toEqual({
            path: handoffPath,
            method: "POST",
            body: { orderId: "42" },
        });
        expect(events).toEqual([{ status: "seller_handoff_declared" }]);
        expect(snapshot(bloc)).toEqual({
            orderNumber: order.orderNumber,
            status: "Handoff declared",
            expeditionNumber: shipment.expeditionNumber,
            latest: "Waiting for the carrier's first scan.",
            message: "",
            contentHidden: false,
            createHidden: true,
            handoffHidden: true,
            labelHidden: false,
            trackingHidden: false,
            trackingUrl: shipment.trackingUrl,
        });
    });

    test("opens only the protected label returned by the declarative label source", async () => {
        const originalClick = HTMLAnchorElement.prototype.click;
        let opened = "";
        HTMLAnchorElement.prototype.click = function () {
            opened = this.href;
        };
        try {
            const { bloc, calls } = await createBloc((call) => {
                if (call.path === readPath) {
                    return { ...order, shipments: [shipment] };
                }
                if (call.path === labelPath) {
                    return { labelUrl: "/.cms/sources/system-functions/downloadShipmentLabel?token=sample" };
                }
                throw new Error(`unexpected request ${call.method} ${call.path}`);
            });
            document.body.append(bloc);
            await waitFor(() => calls.length === 1);
            bloc.querySelector<HTMLButtonElement>("[data-label]")!.click();
            await waitFor(() => calls.length === 2 && opened !== "");

            expect(calls[1]).toEqual({ path: labelPath, method: "POST", body: { orderId: "42" } });
            expect(opened).toBe("http://localhost/.cms/sources/system-functions/downloadShipmentLabel?token=sample");
        } finally {
            HTMLAnchorElement.prototype.click = originalClick;
        }
    });
});

async function waitFor(predicate: () => boolean): Promise<void> {
    const deadline = performance.now() + 1000;
    while (!predicate()) {
        if (performance.now() > deadline) {
            throw new Error("Fulfillment interaction did not settle");
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}
