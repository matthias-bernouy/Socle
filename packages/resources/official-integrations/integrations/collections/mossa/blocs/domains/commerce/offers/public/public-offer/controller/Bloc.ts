import { Component } from "@bernouy/components/base";
import {
    clearResponsiveSourceImageElement,
    syncResponsiveSourceImageElement,
} from "@bernouy/cms-source-images/browser";
import { displayValue, metadataSpecifications, sourceSpecifications, variantSpecifications } from "./specifications";

type RecordValue = Record<string, any>;

export class PublicOffer extends Component {
    static observedAttributes = [
        "back-label",
        "buy-label",
        "buy-url",
        "error-message",
        "error-title",
        "image-fit",
        "locale",
        "model-label",
        "secure-payment-label",
        "buyer-protection-label",
        "tracked-delivery-label",
        "negotiate-label",
        "negotiate-url",
        "price-label",
        "shipping-message",
        "slug-param",
        "valuation-label",
        "valuation-currency",
        "valuation-maximum-field",
        "valuation-minimum-field",
    ];
    private offer: RecordValue | null = null;
    private product: RecordValue | null = null;
    private productSchema: RecordValue | null = null;
    private requestedSlug = "";

    constructor() {
        super({ css: ":host { display: contents; }", template: "<slot></slot>" });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.detail.addEventListener("click", this.onThumbnailClick);
        this.addEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.addEventListener("cms-source:failed", this.onSourceFailed as EventListener);
        this.syncText();
        this.load();
    }

    disconnectedCallback(): void {
        this.querySelector<HTMLElement>("[data-detail]")?.removeEventListener("click", this.onThumbnailClick);
        this.removeEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.removeEventListener("cms-source:failed", this.onSourceFailed as EventListener);
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) {
            return;
        }
        this.syncText();
        if (name === "slug-param") {
            this.load();
        }
    }

    private load(): void {
        this.show("loading");
        if (!this.slug) {
            this.fail();
            return;
        }
        this.requestedSlug = this.slug;
        this.offer = null;
        this.product = null;
        this.productSchema = null;
        setValue(this.querySelector("[data-offer-slug]"), this.requestedSlug);
        this.submit(this.offerSource);
    }

    private onSourceSuccess = (event: CustomEvent<{ body?: unknown }>): void => {
        const body = record(event.detail?.body);
        if (event.target === this.offerSource) {
            if (!body) {
                this.fail();
                return;
            }
            this.offer = body;
            this.product = record(body.product);
            this.renderOffer(body);
            this.show("content");
            const productId = body.productId;
            if (productId != null) {
                setValue(this.querySelector("[data-product-id]"), String(productId));
                this.submit(this.productSource);
            } else {
                this.loadSchema();
            }
            if (this.slug !== this.requestedSlug) {
                this.load();
            }
            return;
        }
        if (event.target === this.productSource) {
            this.product = body ?? this.product;
            this.renderCurrentOffer();
            this.loadSchema();
            return;
        }
        if (event.target === this.schemaSource) {
            this.productSchema = body;
            this.renderCurrentOffer();
        }
    };

    private onSourceFailed = (event: Event): void => {
        if (event.target === this.offerSource) {
            this.fail();
        } else if (event.target === this.productSource) {
            this.renderCurrentOffer();
            this.loadSchema();
        } else if (event.target === this.schemaSource) {
            this.renderCurrentOffer();
        }
    };

    private loadSchema(): void {
        const category = String(this.product?.primaryCategory?.fullSlug ?? "").trim();
        if (!category) {
            return;
        }
        setValue(this.querySelector("[data-schema-category]"), category);
        this.submit(this.schemaSource);
    }

    private renderCurrentOffer(): void {
        if (this.offer) {
            this.renderOffer(this.offer);
        }
    }

    private submit(source: HTMLFormElement): void {
        queueMicrotask(() => source.isConnected && source.requestSubmit());
    }

    private renderOffer(offer: RecordValue): void {
        this.titleElement.textContent = offer.title || offer.product?.title || "Offer";
        const description = String(offer.description || "").trim();
        this.descriptionElement.textContent = description;
        this.descriptionElement.hidden = !description;
        this.conditionBadge.setAttribute("code", String(offer.conditionCode || ""));
        const conditionLabel = String(offer.conditionLabel || "").trim();
        if (conditionLabel) {
            this.conditionBadge.setAttribute("label", conditionLabel);
        } else {
            this.conditionBadge.removeAttribute("label");
        }
        const meta = [offer.product?.brand?.name, offer.product?.primaryCategory?.label].filter(Boolean).join(" · ");
        this.metaElement.textContent = meta;
        this.metaElement.hidden = !meta;
        this.priceElement.textContent = money(offer.acceptedPriceAmount, offer.currency, this.locale);
        this.renderValuation(this.product?.metadata);
        this.renderMedia(Array.isArray(offer.media) ? offer.media : [], offer.title);
        this.renderSpecifications(offer);
        this.buyButton.textContent = `${this.text("buy-label", "Buy")} · ${money(offer.acceptedPriceAmount, offer.currency, this.locale)}`;
        const buyUrl = this.getAttribute("buy-url")?.trim() || "";
        const available = offer.availability === "available";
        if (available && buyUrl) {
            this.buyButton.setAttribute("href", this.url(buyUrl, offer));
            this.buyButton.removeAttribute("aria-disabled");
            this.buyButton.removeAttribute("tabindex");
        } else {
            this.buyButton.removeAttribute("href");
            this.buyButton.setAttribute("aria-disabled", "true");
            this.buyButton.setAttribute("tabindex", "-1");
        }
        const negotiateUrl = this.getAttribute("negotiate-url")?.trim() || "";
        this.negotiateButton.closest("mossa-button")?.toggleAttribute("hidden", !negotiateUrl);
        if (available && negotiateUrl) {
            this.negotiateButton.setAttribute("href", this.url(negotiateUrl, offer));
            this.negotiateButton.removeAttribute("aria-disabled");
            this.negotiateButton.removeAttribute("tabindex");
        } else {
            this.negotiateButton.removeAttribute("href");
            this.negotiateButton.setAttribute("aria-disabled", "true");
            this.negotiateButton.setAttribute("tabindex", "-1");
        }
        this.negotiateButton.textContent = this.text("negotiate-label", "Make an offer");
    }

    private renderMedia(items: RecordValue[], title: string): void {
        const sorted = [...items].sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder));
        const main = sorted.find((item) => item.isMain) || sorted[0];
        if (!main?.media?.id) {
            clearPublicSourceImage(this.mainImage);
            this.mainImage.alt = "";
            return;
        }
        this.setMainImage(main.media, main.media.alt || title);
        for (const [index, image] of [
            ...this.detail.querySelectorAll<HTMLImageElement>('[slot="thumbnails"]'),
        ].entries()) {
            const mediaId = image.dataset.mediaId;
            if (!mediaId) {
                image.hidden = true;
                continue;
            }
            image.hidden = false;
            bindPublicSourceImage(image, this.imageUrl(mediaId), image.dataset.sourceWidth, image.dataset.sourceHeight);
            image.alt ||= `${title} — photo ${index + 1}`;
            image.toggleAttribute("data-active", mediaId === String(main.media.id));
        }
    }

    private renderValuation(metadata: unknown): void {
        const valuation = productValuation(
            metadata,
            this.getAttribute("valuation-minimum-field") || "valuationMinimum",
            this.getAttribute("valuation-maximum-field") || "valuationMaximum",
        );
        if (!valuation) {
            this.valuation.hidden = true;
            return;
        }
        this.valuation.hidden = false;
        this.valuationValue.textContent = `${wholeMoney(valuation.minimum, this.valuationCurrency, this.locale)} – ${wholeMoney(valuation.maximum, this.valuationCurrency, this.locale)}`;
    }

    private renderSpecifications(offer: RecordValue): void {
        this.specifications.replaceChildren();
        const variantId = offer.variantId ?? offer.variant?.id;
        const variants = Array.isArray(this.product?.variants) ? this.product.variants : [];
        const variant =
            variants.find((item) => variantId != null && String(item.id) === String(variantId)) ?? offer.variant;
        const values: Array<[string, unknown, string?]> = [
            [this.text("model-label", "Model"), this.product?.title || offer.product?.title],
            ...variantSpecifications(variant),
            ...sourceSpecifications(offer.specifications),
            ...metadataSpecifications(this.product?.metadata, this.productSchema?.fields, [
                this.getAttribute("valuation-minimum-field") || "valuationMinimum",
                this.getAttribute("valuation-maximum-field") || "valuationMaximum",
            ]),
        ];
        const seen = new Set<string>();
        for (const [label, value, unit] of values) {
            if (value === null || value === undefined || value === "" || seen.has(label)) {
                continue;
            }
            seen.add(label);
            const row = this.ownerDocument.createElement("mossa-specification");
            const labelElement = this.ownerDocument.createElement("span");
            labelElement.slot = "label";
            labelElement.textContent = label;
            const valueElement = this.ownerDocument.createElement("span");
            valueElement.slot = "value";
            valueElement.textContent = displayValue(value, unit);
            row.append(labelElement, valueElement);
            this.specifications.append(row);
        }
        this.specifications.hidden = !this.specifications.childElementCount;
    }

    private onThumbnailClick = (event: Event): void => {
        const image = (event.target as HTMLElement).closest<HTMLImageElement>('[slot="thumbnails"][data-media-id]');
        if (!image) {
            return;
        }
        this.setMainImage(
            {
                id: image.dataset.mediaId!,
                width: image.getAttribute("data-source-width"),
                height: image.getAttribute("data-source-height"),
            },
            image.alt,
        );
        this.detail
            .querySelectorAll('[slot="thumbnails"]')
            .forEach((item) => item.toggleAttribute("data-active", item === image));
    };

    private setMainImage(media: RecordValue, alt: string): void {
        bindPublicSourceImage(this.mainImage, this.imageUrl(media.id), media.width, media.height);
        this.mainImage.alt = alt;
    }
    private imageUrl(mediaId: string | number): string {
        return `/.cms/sources/commerce/publicOfferImage?id=${encodeURIComponent(mediaId)}`;
    }

    private syncText(): void {
        this.errorTitle.textContent = this.text("error-title", "Offer not found");
        this.errorMessage.textContent = this.text(
            "error-message",
            "This offer is no longer available or does not exist.",
        );
        this.backButton.textContent = this.text("back-label", "Back to offers");
        this.priceLabel.textContent = this.text("price-label", "Seller price");
        this.valuationLabel.textContent = this.text("valuation-label", "Reference value");
        this.shippingMessage.textContent = this.text("shipping-message", "Pickup-point delivery available");
        for (const [attribute, fallback] of [
            ["secure-payment-label", "Secure payment"],
            ["buyer-protection-label", "Buyer protection"],
            ["tracked-delivery-label", "Tracked delivery"],
        ]) {
            this.querySelector(`[data-${attribute}]`)!.textContent = this.text(attribute!, fallback!);
        }
        if (this.offer) {
            this.renderSpecifications(this.offer);
        }
        this.mainImage.style.objectFit = this.getAttribute("image-fit") || "contain";
    }

    private fail(): void {
        this.errorMessage.textContent = this.text(
            "error-message",
            "This offer is no longer available or does not exist.",
        );
        this.show("error");
    }
    private show(state: "loading" | "content" | "error"): void {
        this.loading.hidden = state !== "loading";
        this.content.hidden = state !== "content";
        this.error.hidden = state !== "error";
    }
    private url(pattern: string, offer: RecordValue): string {
        return pattern
            .replaceAll("{id}", encodeURIComponent(String(offer.id || "")))
            .replaceAll("{slug}", encodeURIComponent(String(offer.slug || "")));
    }
    private text(name: string, fallback: string): string {
        return this.getAttribute(name)?.trim() || fallback;
    }
    private get slug(): string {
        const href = this.ownerDocument.defaultView?.location.href || "http://localhost/";
        return new URL(href).searchParams.get(this.getAttribute("slug-param") || "slug") || "";
    }
    private get locale(): string {
        return this.getAttribute("locale") || "en-US";
    }
    private get valuationCurrency(): string {
        return (this.getAttribute("valuation-currency")?.trim() || "USD").toUpperCase();
    }
    private get loading() {
        return this.querySelector<HTMLElement>("[data-loading]")!;
    }
    private get content() {
        return this.querySelector<HTMLElement>("[data-content]")!;
    }
    private get error() {
        return this.querySelector<HTMLElement>("[data-error]")!;
    }
    private get detail() {
        return this.querySelector<HTMLElement>("[data-detail]")!;
    }
    private get mainImage() {
        return this.querySelector<HTMLImageElement>("[data-main-image]")!;
    }
    private get titleElement() {
        return this.querySelector<HTMLElement>("[data-title]")!;
    }
    private get metaElement() {
        return this.querySelector<HTMLElement>("[data-meta]")!;
    }
    private get conditionBadge() {
        return this.querySelector<HTMLElement>("[data-condition]")!;
    }
    private get descriptionElement() {
        return this.querySelector<HTMLElement>("[data-description]")!;
    }
    private get valuation() {
        return this.querySelector<HTMLElement>("[data-valuation]")!;
    }
    private get valuationLabel() {
        return this.querySelector<HTMLElement>("[data-valuation-label]")!;
    }
    private get valuationValue() {
        return this.querySelector<HTMLElement>("[data-valuation-value]")!;
    }
    private get priceLabel() {
        return this.querySelector<HTMLElement>("[data-price-label]")!;
    }
    private get priceElement() {
        return this.querySelector<HTMLElement>("[data-price]")!;
    }
    private get specifications() {
        return this.querySelector<HTMLElement>("[data-specifications]")!;
    }
    private get shippingMessage() {
        return this.querySelector<HTMLElement>("[data-shipping-message]")!;
    }
    private get buyButton() {
        return this.querySelector<HTMLAnchorElement>("[data-buy]")!;
    }
    private get negotiateButton() {
        return this.querySelector<HTMLAnchorElement>("[data-negotiate]")!;
    }
    private get errorTitle() {
        return this.querySelector<HTMLElement>("[data-error-title]")!;
    }
    private get errorMessage() {
        return this.querySelector<HTMLElement>("[data-error-message]")!;
    }
    private get backButton() {
        return this.querySelector<HTMLAnchorElement>("[data-back]")!;
    }
    private get offerSource(): HTMLFormElement {
        return this.querySelector<HTMLFormElement>("[data-offer-source]")!;
    }
    private get productSource(): HTMLFormElement {
        return this.querySelector<HTMLFormElement>("[data-product-source]")!;
    }
    private get schemaSource(): HTMLFormElement {
        return this.querySelector<HTMLFormElement>("[data-schema-source]")!;
    }
}

function record(value: unknown): RecordValue | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null;
}

function setValue(element: Element | null, value: string): void {
    const input = element as HTMLInputElement | null;
    if (input) {
        input.value = value;
    }
}

function bindPublicSourceImage(image: HTMLImageElement, url: string, width: unknown, height: unknown): void {
    const sourceWidth = positiveInteger(width);
    const sourceHeight = positiveInteger(height);
    image.setAttribute("data-source-image-access", "public");
    if (sourceWidth !== null && sourceHeight !== null) {
        image.setAttribute("data-source-width", String(sourceWidth));
        image.setAttribute("data-source-height", String(sourceHeight));
    } else {
        image.removeAttribute("data-source-width");
        image.removeAttribute("data-source-height");
    }
    image.setAttribute("data-cms-src", url);
    syncResponsiveSourceImageElement(image);
}

function clearPublicSourceImage(image: HTMLImageElement): void {
    clearResponsiveSourceImageElement(image);
    image.removeAttribute("data-cms-src");
    image.removeAttribute("data-source-width");
    image.removeAttribute("data-source-height");
    image.removeAttribute("data-source-image-access");
}

function positiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function money(amount: unknown, currency: unknown, locale: string): string {
    const value = Number(amount);
    if (!Number.isSafeInteger(value)) {
        return "Price unavailable";
    }
    const rounded = Math.round(value / 100);
    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: String(currency || "USD").toUpperCase(),
            maximumFractionDigits: 0,
        }).format(rounded);
    } catch {
        return `${rounded} ${String(currency || "USD").toUpperCase()}`;
    }
}
function productValuation(
    metadata: unknown,
    minimumField: string,
    maximumField: string,
): { minimum: number; maximum: number } | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return null;
    }
    const values = metadata as RecordValue;
    const minimum = metadataNumber(values[minimumField]);
    const maximum = metadataNumber(values[maximumField]);
    if (minimum === null || maximum === null || minimum < 0 || maximum < minimum) {
        return null;
    }
    return { minimum, maximum };
}
function metadataNumber(value: unknown): number | null {
    if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function wholeMoney(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(Math.round(amount));
}
