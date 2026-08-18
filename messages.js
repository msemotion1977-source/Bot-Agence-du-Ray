const { getStore } = require("@netlify/blobs");
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method not allowed" };
  }
  const params = event.queryStringParameters || {};
  const id = (params.id || "").toString().trim();
  const visitorId = (params.visitorId || "").toString().trim();
  if (!id || !visitorId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Paramètres manquants" };
  }

  const store = getStore({ name: "conversations", consistency: "strong" });
  let conversation;
  try {
    conversation = await store.get(id, { type: "json" });
  } catch (err) {
    console.error("Erreur lecture Blobs :", err && err.message ? err.message : err);
    return { statusCode: 502, headers: CORS_HEADERS, body: "Stockage indisponible" };
  }
  // Même règle que pour message.js : le visitorId doit correspondre exactement.
  if (!conversation || conversation.visitorId !== visitorId) {
    return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: "Introuvable" }) };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: true, status: conversation.status, messages: conversation.messages || [] })
  };
};
