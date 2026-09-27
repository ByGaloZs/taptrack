# TapTrack

TapTrack receives Apple Pay transaction details from an iPhone Shortcut and stores them in Supabase.

## Setup

1. Copy `.env.example` to `.env.local` and configure all variables.
2. Apply all files in `supabase/migrations/` through the Supabase CLI or dashboard SQL editor.
3. Run `npm run dev`.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not use a `NEXT_PUBLIC_` prefix and never place it in the iPhone Shortcut. Generate `TRANSACTIONS_API_KEY` as a long random secret and configure the same value in the Shortcut's Authorization header.

## Google Sheets Sync

Newly created Supabase transactions are mirrored to the existing `TapTrack - Finanzas` spreadsheet. Supabase remains the source of truth: a Google Sheets sync failure is logged on the server but does not fail the transaction API request.

1. Open [script.google.com](https://script.google.com), create a new Apps Script project, and replace its default source with `google-apps-script/Code.gs` from this project.
2. In the Apps Script editor, open Project Settings, then Script Properties. Add `TAPTRACK_SPREADSHEET_ID` with the ID from the existing `TapTrack - Finanzas` spreadsheet URL, and `TAPTRACK_WEBHOOK_SECRET` with the same secret used by TapTrack's `GOOGLE_SHEETS_WEBHOOK_SECRET`. Do not create a new spreadsheet.
3. Deploy the project as a Web App. Set Execute as to `Me` and Who has access to `Anyone`.
4. Copy the deployed Web App URL ending in `/exec` and set it as `GOOGLE_SHEETS_WEBHOOK_URL` in TapTrack's `.env.local`.
5. Set `GOOGLE_SHEETS_WEBHOOK_SECRET` in `.env.local` to the exact same value as `TAPTRACK_WEBHOOK_SECRET`. It is included only in the server-to-server webhook request and must not be added to the iPhone Shortcut.

The `Transacciones` tab receives new rows in this order: Fecha, Comercio, Importe, Moneda, Categoría, Tarjeta, Fuente, ID transacción.

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
    "category": "Supermercado",
    "occurredAt": "2026-09-27T15:14:00+02:00",
    "source": "apple_pay"
  }'
```
