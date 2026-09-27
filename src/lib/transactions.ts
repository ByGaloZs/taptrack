import { z } from "zod";

export const transactionCategories = [
  "Supermercado",
  "Transporte",
  "Vivienda",
  "Ocio",
  "Viajes",
  "Otro",
] as const;

export const transactionSchema = z.object({
  clientTransactionId: z.string().trim().min(1).optional(),
  merchant: z.string().trim().min(1),
  amount: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  card: z.string().trim().min(1),
  category: z.enum(transactionCategories),
  occurredAt: z.iso.datetime({ offset: true }),
  source: z.literal("apple_pay"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export type TransactionRow = {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  card: string;
  category: string | null;
  occurred_at: string;
  source: string;
  client_transaction_id: string | null;
  created_at: string;
};

export function toTransactionResponse(transaction: TransactionRow) {
  return {
    id: transaction.id,
    merchant: transaction.merchant,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    card: transaction.card,
    category: transaction.category,
    occurredAt: transaction.occurred_at,
    source: transaction.source,
  };
}
