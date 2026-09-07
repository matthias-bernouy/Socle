import { Component } from "@bernouy/components/base";
import css from "./filters.css" with { type: "text" };
import template from "./filters.html" with { type: "text" };
export class DashboardTableFilters extends Component {
    constructor() {
        super({ css: css as unknown as string, template: template as unknown as string });
    }
}
customElements.define("cms-dashboard-table-filters", DashboardTableFilters);
