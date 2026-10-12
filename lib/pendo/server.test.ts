import { afterEach, describe, expect, it, vi } from "vitest";
import { shopperActor, trackServerEvent } from "./server";

describe("server track events", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends nothing without the shared secret", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PENDO_TRACK_EVENT_SECRET", "");
    trackServerEvent("order_placed", { visitorId: "user_0001" }, { total: 4200 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the event with its visitor, account, and cleaned-up properties", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PENDO_TRACK_EVENT_SECRET", "test-secret");
    trackServerEvent(
      "orders_exported",
      { visitorId: "user_0001", accountId: "store_fernhollow" },
      { count: 3, status: undefined, fieldsChanged: ["name"], note: "x".repeat(150) },
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://data.pendo.io/data/track");
    expect(new Headers(init.headers).get("x-pendo-integration-key")).toBe("test-secret");
    const body = JSON.parse(String(init.body)) as {
      timestamp: unknown;
      properties: Record<string, unknown>;
    };
    expect(body).toMatchObject({
      type: "track",
      event: "orders_exported",
      visitorId: "user_0001",
      accountId: "store_fernhollow",
      properties: { count: 3, fieldsChanged: ["name"] },
    });
    expect(typeof body.timestamp).toBe("number");
    expect(body.properties).not.toHaveProperty("status");
    expect(body.properties.note).toHaveLength(100);
  });

  it("logs a failed send instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.stubEnv("PENDO_TRACK_EVENT_SECRET", "test-secret");
    expect(() => trackServerEvent("plan_changed", { visitorId: "user_0001" })).not.toThrow();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    error.mockRestore();
  });

  it("identifies signed-in users by id and anonymous shoppers by cart", () => {
    expect(shopperActor(null, "cart_0001")).toEqual({ visitorId: "cart_0001" });
    expect(
      shopperActor(
        {
          user: { id: "user_0001", email: "owner@example.com", name: "Owner", role: "owner" },
          store: {
            id: "store_fernhollow",
            name: "Fernhollow Nursery",
            slug: "fernhollow-nursery",
            plan: "pro",
            trialEndsAt: null,
          },
          expires: "2026-11-01T00:00:00.000Z",
        },
        "cart_0001",
      ),
    ).toEqual({ visitorId: "user_0001", accountId: "store_fernhollow" });
  });
});
