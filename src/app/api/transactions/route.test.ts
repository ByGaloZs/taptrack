import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mocks.from }),
}));

import { POST } from "./route";

const payload = {
  merchant: "Arbitrade Madrid 2",
  amount: 1.8,
  currency: "EUR",
  card: "MASTERCARD BSCARD",
  occurredAt: "2026-09-27T15:14:00+02:00",
  source: "apple_pay",
};

const transaction = {
  id: "393c6d75-902f-4eb4-ba85-c5025dd6aa45",
  merchant: payload.merchant,
  amount: payload.amount,
  currency: payload.currency,
  card: payload.card,
  occurred_at: payload.occurredAt,
  source: payload.source,
  client_transaction_id: null,
  created_at: "2026-09-27T13:14:00.000Z",
};

function request(body: unknown, authorization: string | null = "Bearer test-secret") {
  const headers: Record<string, string> = { "content-type": "application/json" };

  if (authorization) {
    headers.authorization = authorization;
  }

  return new Request("http://localhost/api/transactions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function mockEvents() {
  const eventUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const eventInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "event-1" }, error: null }) }),
  });

  return { eventInsert, eventUpdate, eventTable: { insert: eventInsert, update: eventUpdate } };
}

function mockTransactionInsert(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert };
}

describe("POST /api/transactions", () => {
  beforeEach(() => {
    process.env.TRANSACTIONS_API_KEY = "test-secret";
    mocks.from.mockReset();
  });

  it("preserves the raw payload and marks a valid transaction as processed", async () => {
    const events = mockEvents();
    const transactions = mockTransactionInsert({ data: transaction, error: null });
    mocks.from.mockImplementation((table) =>
      table === "transaction_events" ? events.eventTable : transactions,
    );

    const response = await POST(request(payload));

    expect(response.status).toBe(201);
    expect(events.eventInsert).toHaveBeenCalledWith({ payload, status: "received" });
    expect(events.eventUpdate).toHaveBeenCalledWith({
      status: "processed",
      transaction_id: transaction.id,
    });
    expect(transactions.insert).toHaveBeenCalledWith({
      merchant: payload.merchant,
      amount: payload.amount,
      currency: payload.currency,
      card: payload.card,
      occurred_at: payload.occurredAt,
      source: "apple_pay",
      client_transaction_id: null,
    });
  });

  it.each([null, "Bearer wrong-secret"])("returns 401 without storing %s authorization", async (authorization) => {
    const response = await POST(request(payload, authorization));

    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("marks an invalid payload as failed with a sanitized summary", async () => {
    const events = mockEvents();
    mocks.from.mockReturnValue(events.eventTable);

    const response = await POST(request({ ...payload, currency: "eur" }));

    expect(response.status).toBe(400);
    expect(events.eventInsert).toHaveBeenCalledWith({
      payload: { ...payload, currency: "eur" },
      status: "received",
    });
    expect(events.eventUpdate).toHaveBeenCalledWith({
      status: "failed",
      error: "currency: invalid_format",
    });
  });

  it("returns an existing transaction and marks its event processed", async () => {
    const events = mockEvents();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { ...transaction, client_transaction_id: "test-001" },
      error: null,
    });
    const transactions = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
    mocks.from.mockImplementation((table) =>
      table === "transaction_events" ? events.eventTable : transactions,
    );

    const response = await POST(request({ ...payload, clientTransactionId: "test-001" }));

    expect(response.status).toBe(200);
    expect(events.eventUpdate).toHaveBeenCalledWith({
      status: "processed",
      transaction_id: transaction.id,
    });
  });

  it("does not expose database errors", async () => {
    const events = mockEvents();
    const transactions = mockTransactionInsert({
      data: null,
      error: { message: "relation credentials leaked", code: "42P01" },
    });
    mocks.from.mockImplementation((table) =>
      table === "transaction_events" ? events.eventTable : transactions,
    );

    const response = await POST(request(payload));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to store transaction" });
    expect(events.eventUpdate).toHaveBeenLastCalledWith({
      status: "failed",
      error: "Transaction processing failed",
    });
  });
});
