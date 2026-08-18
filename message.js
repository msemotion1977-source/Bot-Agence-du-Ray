const { getStore } = require("@netlify/blobs");
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method not allowed" };
  }
  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Invalid JSON" };
  }
  const id = (data.id || "").toString().trim();
  const visitorId = (data.visitorId || "").toString().trim();
  const text = (data.text || "").toString().trim().slice(0, 1000);
  if (!id || !visitorId || !text) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Champs manquants" };
  }

  const store = getStore({ name: "conversations", consistency: "strong" });
  let conversation;
  try {
    conversation = await store.get(id, { type: "json" });
  } catch (err) {
    console.error("Erreur lecture Blobs :", err && err.message ? err.message : err);
    return { statusCode: 502, headers: CORS_HEADERS, body: "Stockage indisponible" };
  }
  // Le visitorId doit correspondre : ça empêche quiconque connaîtrait l'id de la
  // conversation de lire ou d'écrire dans la discussion d'un autre visiteur.
  if (!conversation || conversation.visitorId !== visitorId) {
    return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: "Conversation introuvable" }) };
  }

  conversation.messages = conversation.messages || [];
  conversation.messages.push({ from: "visitor", text, at: new Date().toISOString() });
  conversation.status = "new";
  conversation.updatedAt = new Date().toISOString();

  try {
    await store.setJSON(id, conversation);
  } catch (err) {
    console.error("Erreur écriture Blobs :", err && err.message ? err.message : err);
  }

  // Relance l'agent sur Telegram, en réponse au fil existant si possible (threading)
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const body = {
        chat_id: chatId,
        text: `💬 ${conversation.site || "Site"} : ${text}`
      };
      if (conversation.telegramMessageId) {
        body.reply_to_message_id = conversation.telegramMessageId;
      }
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json && json.ok && json.result && json.result.message_id) {
        conversation.telegramMessageId = json.result.message_id;
        await store.setJSON(id, conversation);
        const index = getStore({ name: "telegram-index", consistency: "strong" });
        await index.setJSON(String(json.result.message_id), { conversationId: id });
      }
    }
  } catch (err) {
    console.error("Erreur relance Telegram :", err && err.message ? err.message : err);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: true, messages: conversation.messages })
  };
};
