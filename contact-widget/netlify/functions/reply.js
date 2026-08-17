const { getStore } = require("@netlify/blobs");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-password"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method not allowed" };
  }

  const password = event.headers["x-admin-password"] || event.headers["X-Admin-Password"];
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Non autorisé" }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Invalid JSON" };
  }

  const { id, replyText } = data;
  if (!id) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "id manquant" };
  }

  const store = getStore({ name: "conversations", consistency: "strong" });
  const conversation = await store.get(id, { type: "json" });
  if (!conversation) {
    return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: "Conversation introuvable" }) };
  }

  // NOTE : cette réponse reste interne (note pour l'historique). Comme le système n'utilise
  // aucun service payant, l'agent recontacte le visiteur elle-même (téléphone/SMS personnel,
  // ou WhatsApp) en utilisant le numéro affiché. Ce champ sert juste à garder une trace.
  if (replyText && replyText.trim()) {
    conversation.reply = replyText.trim().slice(0, 1000);
    conversation.repliedAt = new Date().toISOString();
  }
  conversation.status = "answered";
  await store.setJSON(id, conversation);

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, conversation }) };
};
