import { describe, expect, test } from "bun:test";
import { prepare_bloc } from "@bernouy/cms-bloc-compile";
import { createBlocUsageResolver } from "@bernouy/cms-content";
import { FsIntegrationDefinitionRepository } from "@bernouy/cms-integrations/fs";
import { OFFICIAL_INTEGRATIONS_ROOT } from "@bernouy/cms-official-integrations";

describe("Commerce schema-driven offer filter dependencies", () => {
    test("loads the Mossa select runtime even when selects only appear dynamically", async () => {
        const definition = await new FsIntegrationDefinitionRepository(OFFICIAL_INTEGRATIONS_ROOT).get("mossa");
        const artifact = definition?.artifacts?.find(
            (candidate) => candidate.type === "bloc" && candidate.bloc.tag === "mossa-commerce-offer-filter",
        );
        const controller = definition?.artifacts?.find(
            (candidate) => candidate.type === "bloc" && candidate.bloc.tag === "mossa-commerce-offer-filter-controller",
        );
        if (
            !artifact ||
            artifact.type !== "bloc" ||
            !artifact.bloc.compositionHTML ||
            !controller ||
            controller.type !== "bloc" ||
            !controller.bloc.viewJS
        ) {
            throw new Error("mossa-commerce-offer-filter composition sources not found");
        }
        const compiled = await prepare_bloc(
            new File([controller.bloc.viewJS], "Bloc.ts", { type: "text/typescript" }),
            null,
            controller.bloc.name,
            controller.bloc.group ?? "Commerce",
            controller.bloc.description ?? "",
            controller.bloc.tag,
            controller.bloc.source,
            undefined,
            { viewPath: controller.bloc.view ?? "controller/Bloc.ts" },
        );
        const resolveUsage = createBlocUsageResolver(
            [
                "mossa-option",
                "mossa-select",
                "mossa-commerce-offer-filter",
                "mossa-commerce-offer-filter-controller",
            ].map((id) => ({
                id,
                ...(id === "mossa-commerce-offer-filter" ? { compositionHTML: artifact.bloc.compositionHTML } : {}),
            })),
            {
                getBlocViewJS: async (tag) =>
                    tag === "mossa-commerce-offer-filter-controller" ? compiled.viewJS : null,
            },
        );

        expect(await resolveUsage("<mossa-commerce-offer-filter></mossa-commerce-offer-filter>")).toEqual(
            expect.arrayContaining([
                "mossa-commerce-offer-filter",
                "mossa-commerce-offer-filter-controller",
                "mossa-option",
                "mossa-select",
            ]),
        );
    });
});
