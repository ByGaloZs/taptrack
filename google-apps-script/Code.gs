function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "invalid_payload" });
    }

    const payload = JSON.parse(e.postData.contents);
    const webhookSecret = PropertiesService.getScriptProperties().getProperty(
      "TAPTRACK_WEBHOOK_SECRET",
    );

    if (!webhookSecret || payload.secret !== webhookSecret) {
      return jsonResponse({ ok: false, error: "unauthorized" });
    }

    if (!isValidTransaction(payload)) {
      return jsonResponse({ ok: false, error: "invalid_payload" });
    }

    const occurredAt = new Date(payload.occurredAt);

    if (Number.isNaN(occurredAt.getTime())) {
      return jsonResponse({ ok: false, error: "invalid_payload" });
    }

    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
      "TAPTRACK_SPREADSHEET_ID",
    );

    if (!spreadsheetId) {
      throw new Error("Missing TAPTRACK_SPREADSHEET_ID");
    }

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Transacciones");

    if (!sheet) {
      throw new Error("Missing Transacciones sheet");
    }

    sheet.appendRow([
      occurredAt,
      payload.merchant,
      payload.amount,
      payload.currency,
      payload.category,
      payload.card,
      payload.source,
      payload.id,
    ]);

    return jsonResponse({ ok: true });
  } catch {
    console.error("TapTrack Google Sheets sync failed.");
    return jsonResponse({ ok: false, error: "internal_error" });
  }
}

function isValidTransaction(payload) {
  return (
    payload &&
    typeof payload.id === "string" &&
    typeof payload.merchant === "string" &&
    typeof payload.amount === "number" &&
    Number.isFinite(payload.amount) &&
    typeof payload.currency === "string" &&
    typeof payload.category === "string" &&
    typeof payload.card === "string" &&
    typeof payload.occurredAt === "string" &&
    typeof payload.source === "string"
  );
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
