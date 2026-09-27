# TapTrack

TapTrack receives Apple Pay transaction details from an iPhone Shortcut and stores them in Supabase.

## Setup

1. Copy `.env.example` to `.env.local` and configure all variables.
2. Apply `supabase/migrations/20260927160000_create_transactions.sql` through the Supabase CLI or dashboard SQL editor.
3. Run `npm run dev`.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not use a `NEXT_PUBLIC_` prefix and never place it in the iPhone Shortcut. Generate `TRANSACTIONS_API_KEY` as a long random secret and configure the same value in the Shortcut's Authorization header.

## Test The Endpoint

```sh
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "clientTransactionId": "test-001",
    "merchant": "Arbitrade Madrid 2",
    "amount": 1.80,
    "currency": "EUR",
    "card": "MASTERCARD BSCARD",
    "occurredAt": "2026-09-27T15:14:00+02:00",
    "source": "apple_pay"
  }'
```
