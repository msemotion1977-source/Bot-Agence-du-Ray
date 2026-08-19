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

  const text = (replyText || "").toString().trim().slice(0, 1000);

  // CORRECTIF : avant, ce texte était juste enregistré comme une "note" interne,
  // invisible pour le visiteur. Maintenant il est ajouté au VRAI fil de discussion
  // (exactement comme une réponse Telegram) : le visiteur le voit apparaître dans
  // sa bulle de chat en direct, car le widget vérifie les nouveaux messages
  // toutes les 4 secondes.
  if (text) {
    conversation.messages = conversation.messages || [];
    conversation.messages.push({ from: "agent", text, at: new Date().toISOString() });
    conversation.reply = text;
    conversation.repliedAt = new Date().toISOString();
  }
  conversation.status = "answered";
  conversation.updatedAt = new Date().toISOString();
  await store.setJSON(id, conversation);

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, conversation }) };
};
