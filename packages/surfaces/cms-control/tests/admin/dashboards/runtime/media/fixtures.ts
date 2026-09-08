import type { SubmitAction } from "cms-control/components/admin/Resources/Dashboards/runtime/actions/forms";
import type { DashboardDto } from "@bernouy/cms-dashboards";
import type { DashboardSourceGroup } from "cms-control/components/admin/Resources/Dashboards/types";

export function dashboard(): DashboardDto {
    return {
        id: "forms",
        source: "forms",
        views: [
            {
                widget: "w-detail",
                id: "questionDetail",
                source: { endpoint: "manageQuestion", params: { ref: "$selection.id" } },
                main: [
                    {
                        id: "choices",
                        title: "Choices",
                        fields: [
                            {
                                id: "imageOptions",
                                label: "Images",
                                path: "options",
                                type: "reorderable-list",
                                itemKey: "key",
                                fields: [
                                    {
                                        id: "image",
                                        label: "Image",
                                        path: "image",
                                        type: "media",
                                        item: { idPath: "mediaId", urlPath: "url", altPath: "alt" },
                                        actions: {
                                            upload: {
                                                endpoint: "uploadChoiceImage",
                                                params: { ref: "$resource.ref" },
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

export function group(): DashboardSourceGroup {
    return {
        source: {
            urn: "urn:forms",
            id: "forms",
            name: "Forms",
            endpointCount: 2,
            dashboardCount: 1,
            readonly: false,
        },
        endpoints: [
            {
                endpointId: "manageQuestion",
                method: "GET",
                targetUrl: "https://forms.test/question",
                params: [{ name: "ref", in: "query", type: "string" }],
            },
            {
                endpointId: "uploadChoiceImage",
                method: "POST",
                targetUrl: "https://forms.test/image",
                params: [{ name: "ref", in: "query", type: "string" }],
            },
        ],
        dashboards: [],
    };
}

// The runtime test checks upload arguments; browser tests exercise native file form submission.
export const uploadSubmission: SubmitAction = async ({ url, method, file }) => {
    const body = new FormData();
    body.set("file", file!);
    const response = await fetch(url, { method, body });
    return response.json();
};
