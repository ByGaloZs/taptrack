import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

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
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (authorization) {
    headers.authorization = authorization;
  }

  return new Request("http://localhost/api/transactions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function mockInsert(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  mocks.from.mockReturnValue({ insert });
  return insert;
}

describe("POST /api/transactions", () => {
  beforeEach(() => {
    process.env.TRANSACTIONS_API_KEY = "test-secret";
    mocks.from.mockReset();
  });

  it("returns 201 for a valid transaction", async () => {
    mockInsert({ data: transaction, error: null });

    const response = await POST(request(payload));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: transaction.id,
        merchant: payload.merchant,
        amount: 1.8,
        currency: "EUR",
        card: payload.card,
        occurredAt: payload.occurredAt,
        source: "apple_pay",
      },
    });
  });

  it.each([null, "Bearer wrong-secret"]) (
    "returns 401 for %s authorization",
    async (authorization) => {
      const response = await POST(request(payload, authorization));

      expect(response.status).toBe(401);
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(request({ ...payload, currency: "eur" }));

    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("inserts the validated transaction values", async () => {
    const insert = mockInsert({ data: transaction, error: null });

    await POST(request(payload));

    expect(insert).toHaveBeenCalledWith({
      merchant: payload.merchant,
      amount: payload.amount,
      currency: payload.currency,
      card: payload.card,
      occurred_at: payload.occurredAt,
      source: "apple_pay",
      client_transaction_id: null,
    });
  });

  it("returns the existing transaction for a duplicate clientTransactionId", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { ...transaction, client_transaction_id: "test-001" },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn();
    mocks.from.mockReturnValue({ select, insert });

    const response = await POST(request({ ...payload, clientTransactionId: "test-001" }));

    expect(response.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ data: { id: transaction.id } });
  });

  it("does not expose database errors", async () => {
    mockInsert({ data: null, error: { message: "relation credentials leaked", code: "42P01" } });

    const response = await POST(request(payload));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to store transaction" });
  });
});
