import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  toTransactionResponse,
  transactionSchema,
  type TransactionInput,
  type TransactionRow,
} from "@/lib/transactions";

export const runtime = "nodejs";

function isAuthorized(authorization: string | null) {
  const expectedKey = process.env.TRANSACTIONS_API_KEY;

  if (!expectedKey || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice("Bearer ".length);
  const expected = Buffer.from(expectedKey);
  const received = Buffer.from(token);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

function insertValues(transaction: TransactionInput) {
  return {
    merchant: transaction.merchant,
    amount: transaction.amount,
    currency: transaction.currency,
    card: transaction.card,
    occurred_at: transaction.occurredAt,
    source: transaction.source,
    client_transaction_id: transaction.clientTransactionId ?? null,
  };
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = transactionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction payload" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();

    if (parsed.data.clientTransactionId) {
      const { data: existing, error: lookupError } = await supabase
        .from("transactions")
        .select()
        .eq("client_transaction_id", parsed.data.clientTransactionId)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existing) {
        return NextResponse.json({ data: toTransactionResponse(existing as TransactionRow) });
      }
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert(insertValues(parsed.data))
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && parsed.data.clientTransactionId) {
        const { data: existing, error: lookupError } = await supabase
          .from("transactions")
          .select()
          .eq("client_transaction_id", parsed.data.clientTransactionId)
          .single();

        if (!lookupError && existing) {
          return NextResponse.json({ data: toTransactionResponse(existing as TransactionRow) });
        }
      }

      throw error;
    }

    return NextResponse.json(
      { data: toTransactionResponse(data as TransactionRow) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Unable to store transaction" }, { status: 500 });
  }
}
