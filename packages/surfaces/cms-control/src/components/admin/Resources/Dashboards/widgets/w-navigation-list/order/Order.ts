import { hasMissingTechnicalFields } from "../../../runtime/actions/forms/views/technicalFields";
import { orderedItems } from "./items";
import { observeSource, refreshSourceContext, setSourceContext, showToast } from "@bernouy/components";
import {
    CMS_SOURCE_SUCCESS_EVENT,
    CMS_SOURCE_FAILED_EVENT,
    CMS_SOURCE_REFRESH_FAILED_EVENT,
} from "@bernouy/components/binding";

/** Coordinates the list's local order; the associated form owns transport and locking. */
export class NavigationOrder {
    draft: string[] | null = null;
    busy = false;
    private awaitingRead = false;
    private stop?: () => void;

    constructor(
        private readonly host: HTMLElement,
        readonly form: HTMLFormElement,
        private readonly source: HTMLElement,
    ) {}

    connect(): void {
        setSourceContext(this.source, (data) => ({
            navigationItems: orderedItems(data, this.host, this.draft),
        }));
        this.form.addEventListener(CMS_SOURCE_SUCCESS_EVENT, this.success);
        this.form.addEventListener(CMS_SOURCE_FAILED_EVENT, this.failed);
        this.form.addEventListener(CMS_SOURCE_REFRESH_FAILED_EVENT, this.readFailed);
        this.stop = observeSource(this.source, (state) => {
            if (
                this.awaitingRead &&
                (state.loaded || state.empty) &&
                !state.loading &&
                !state.refreshing &&
                !state.error &&
                !state.refreshError
            ) {
                this.finish();
            }
        });
    }

    disconnect(): void {
        this.stop?.();
        this.busy = false;
        this.awaitingRead = false;
        this.draft = null;
        this.host.removeAttribute("aria-busy");
        this.form.removeEventListener(CMS_SOURCE_SUCCESS_EVENT, this.success);
        this.form.removeEventListener(CMS_SOURCE_FAILED_EVENT, this.failed);
        this.form.removeEventListener(CMS_SOURCE_REFRESH_FAILED_EVENT, this.readFailed);
    }

    submit(order: string[]): void {
        if (this.busy || !this.form.isConnected) {
            return;
        }
        if (hasMissingTechnicalFields(this.form)) {
            showToast("The order cannot be saved because its parent identity is unavailable.", { type: "error" });
            return;
        }
        this.draft = order;
        this.busy = true;
        this.host.setAttribute("aria-busy", "true");
        refreshSourceContext(this.source);
        queueMicrotask(() => {
            if (this.form.isConnected && this.draft === order) {
                this.form.requestSubmit();
            }
        });
    }

    private finish(): void {
        this.draft = null;
        this.awaitingRead = false;
        this.busy = false;
        this.host.removeAttribute("aria-busy");
        refreshSourceContext(this.source);
    }

    private success = (event: Event): void => {
        if (event.target === this.form) {
            this.finish();
        }
    };
    private failed = (event: Event): void => {
        if (event.target === this.form) {
            this.finish();
            showToast("The order could not be saved. The previous order has been restored.", { type: "error" });
        }
    };
    private readFailed = (event: Event): void => {
        if (event.target === this.form) {
            this.awaitingRead = true;
        }
    };
}
