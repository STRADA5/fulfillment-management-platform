import "server-only";

export type CarrierCode = "test" | "usps" | "ups" | "fedex" | "dhl";
export type ShippingPackageInput = { packageId: string; weight: number; weightUnit: string; length: number; width: number; height: number; dimensionUnit: string };
export type ShippingQuote = { carrier: CarrierCode; serviceCode: string; currency: string; baseCharge: number; fuelSurcharge: number; handlingCharge: number; quoteReference: string };
export type ShippingLabel = { providerLabelId: string; trackingNumber: string; labelReference: string; format: "test-reference" | "zpl" | "pdf" };
export type NormalizedTrackingEvent = { providerEventId: string; status: "label_created" | "pre_transit" | "picked_up" | "in_transit" | "out_for_delivery" | "delayed" | "exception" | "delivered" | "returned" | "unknown"; occurredAt: string; message?: string };

export interface CarrierAdapter {
  readonly code: CarrierCode;
  quote(input: ShippingPackageInput, serviceCode: string, currency: string): Promise<ShippingQuote>;
  createLabel(input: ShippingPackageInput, serviceCode: string, idempotencyKey: string): Promise<ShippingLabel>;
  voidLabel(providerLabelId: string, idempotencyKey: string): Promise<void>;
  normalizeTrackingEvent(payload: unknown): NormalizedTrackingEvent;
}

export class LocalTestCarrierAdapter implements CarrierAdapter {
  readonly code = "test" as const;
  async quote(input: ShippingPackageInput, serviceCode: string, currency: string): Promise<ShippingQuote> {
    const baseCharge = Number((input.weight * 1.25 + (input.length * input.width * input.height) / 5000 + 5).toFixed(2));
    return { carrier: this.code, serviceCode, currency, baseCharge, fuelSurcharge: Number((baseCharge * 0.12).toFixed(2)), handlingCharge: 2, quoteReference: `LOCAL-QUOTE-${input.packageId.replaceAll("-", "")}` };
  }
  async createLabel(input: ShippingPackageInput, serviceCode: string, _idempotencyKey: string): Promise<ShippingLabel> {
    void _idempotencyKey;
    const token = input.packageId.replaceAll("-", "").slice(0, 16).toUpperCase();
    return { providerLabelId: `TEST-LABEL-${serviceCode}-${input.packageId.replaceAll("-", "")}`, trackingNumber: `TEST-${token}`, labelReference: `local://${input.packageId}`, format: "test-reference" };
  }
  async voidLabel(_providerLabelId: string, _idempotencyKey: string) { void _providerLabelId; void _idempotencyKey; return; }
  normalizeTrackingEvent(payload: unknown): NormalizedTrackingEvent {
    const value = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
    const status = typeof value.status === "string" ? value.status : "unknown";
    const allowed: NormalizedTrackingEvent["status"][] = ["label_created", "pre_transit", "picked_up", "in_transit", "out_for_delivery", "delayed", "exception", "delivered", "returned", "unknown"];
    return { providerEventId: String(value.providerEventId ?? "local-event"), status: allowed.includes(status as NormalizedTrackingEvent["status"]) ? status as NormalizedTrackingEvent["status"] : "unknown", occurredAt: typeof value.occurredAt === "string" ? value.occurredAt : new Date().toISOString(), message: typeof value.message === "string" ? value.message : undefined };
  }
}

class UnconfiguredCarrierAdapter implements CarrierAdapter {
  constructor(readonly code: Exclude<CarrierCode, "test">) {}
  async quote(input: ShippingPackageInput, serviceCode: string, currency: string): Promise<ShippingQuote> { void input; void serviceCode; void currency; throw new Error(`${this.code.toUpperCase()} adapter is not configured in local mode.`); }
  async createLabel(input: ShippingPackageInput, serviceCode: string, idempotencyKey: string): Promise<ShippingLabel> { void input; void serviceCode; void idempotencyKey; throw new Error(`${this.code.toUpperCase()} adapter is not configured in local mode.`); }
  async voidLabel(providerLabelId: string, idempotencyKey: string): Promise<void> { void providerLabelId; void idempotencyKey; throw new Error(`${this.code.toUpperCase()} adapter is not configured in local mode.`); }
  normalizeTrackingEvent(): NormalizedTrackingEvent { return { providerEventId: "unconfigured", status: "unknown", occurredAt: new Date().toISOString() }; }
}

export const carrierAdapters: Record<CarrierCode, CarrierAdapter> = {
  test: new LocalTestCarrierAdapter(), usps: new UnconfiguredCarrierAdapter("usps"), ups: new UnconfiguredCarrierAdapter("ups"), fedex: new UnconfiguredCarrierAdapter("fedex"), dhl: new UnconfiguredCarrierAdapter("dhl"),
};
