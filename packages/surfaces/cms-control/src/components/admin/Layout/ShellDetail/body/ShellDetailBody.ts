import { Component } from "@bernouy/components/base";
import css from "./style.css" with { type: "text" };
import template from "./template.html" with { type: "text" };

export class CmsShellDetailBody extends Component {
    constructor() {
        super({ css: css as unknown as string, template: template as unknown as string });
    }
}

if (!customElements.get("cms-shell-detail-body")) {
    customElements.define("cms-shell-detail-body", CmsShellDetailBody);
}
