import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database, Json } from "@/lib/database.types";
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

function validationSummary(error: { issues: Array<{ path: PropertyKey[]; code: string }> }) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.code}`)
    .join("; ")
    .slice(0, 1000);
}

async function updateEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  values: Database["public"]["Tables"]["transaction_events"]["Update"],
) {
  const { error } = await supabase.from("transaction_events").update(values).eq("id", eventId);

  if (error) {
    throw error;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload: unknown = await request.json().catch(() => null);
  let eventId: string | undefined;

  try {
    const supabase = createSupabaseServerClient();
    const { data: event, error: eventError } = await supabase
      .from("transaction_events")
      .insert({ payload: payload as Json, status: "received" })
      .select("id")
      .single();

    if (eventError || !event) {
      throw eventError ?? new Error("Transaction event was not created");
    }

    eventId = event.id;
    const parsed = transactionSchema.safeParse(payload);

    if (!parsed.success) {
      await updateEvent(supabase, eventId, {
        status: "failed",
        error: validationSummary(parsed.error),
      });

      return NextResponse.json({ error: "Invalid transaction payload" }, { status: 400 });
    }

    let transaction: TransactionRow;
    let status = 201;

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
        transaction = existing as TransactionRow;
        status = 200;
      } else {
        const { data, error } = await supabase
          .from("transactions")
          .insert(insertValues(parsed.data))
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            const { data: existing, error: lookupError } = await supabase
              .from("transactions")
              .select()
              .eq("client_transaction_id", parsed.data.clientTransactionId)
              .single();

            if (!lookupError && existing) {
              transaction = existing as TransactionRow;
              status = 200;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        } else {
          transaction = data as TransactionRow;
        }
      }
    } else {
      const { data, error } = await supabase
        .from("transactions")
        .insert(insertValues(parsed.data))
        .select()
        .single();

      if (error) {
        throw error;
      }

      transaction = data as TransactionRow;
    }

    await updateEvent(supabase, eventId, {
      status: "processed",
      transaction_id: transaction.id,
    });

    return NextResponse.json({ data: toTransactionResponse(transaction) }, { status });
  } catch {
    if (eventId) {
      try {
        const supabase = createSupabaseServerClient();
        await updateEvent(supabase, eventId, {
          status: "failed",
          error: "Transaction processing failed",
        });
      } catch {
        // The original error remains intentionally hidden from the client.
      }
    }

    return NextResponse.json({ error: "Unable to store transaction" }, { status: 500 });
  }
}
