import { Component } from "@bernouy/components/base";
import css from "./tile.css" with { type: "text" };

export class MediaTile extends Component {
    constructor() {
        super({
            css,
            template:
                '<slot></slot><button type="button" data-media-action="remove" aria-label="Remove media" title="Remove media">x</button>',
        });
    }
}
customElements.define("cms-dashboard-media-tile", MediaTile);

export class MediaAddTile extends Component {
    constructor() {
        super({ css, template: '<button type="button" data-media-action="upload" aria-label="Add media">+</button>' });
    }
}
customElements.define("cms-dashboard-media-add", MediaAddTile);
