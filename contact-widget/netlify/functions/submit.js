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

  // Piège à robots : un vrai visiteur ne remplit jamais ce champ caché
  if (data.hp) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  }

  const type = data.type === "call" ? "call" : data.type === "question" ? "question" : null;
  if (!type) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Missing/invalid type" };
  }
  const phone = (data.phone || "").toString().trim().slice(0, 40);
  const question = (data.question || "").toString().trim().slice(0, 1000);
  const site = (data.site || "site inconnu").toString().trim().slice(0, 120);
  const pageUrl = (data.pageUrl || "").toString().trim().slice(0, 300);

  if (type === "call" && !phone) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Phone required for call" };
  }
  if (type === "question" && !question) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Question required" };
  }

  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
  const conversation = {
    id,
    createdAt: new Date().toISOString(),
    site,
    pageUrl,
    type,
    phone: phone || null,
    question: question || null,
    status: "new",
    reply: null,
    repliedAt: null
  };

  const store = getStore({ name: "conversations", consistency: "strong" });
  await store.setJSON(id, conversation);

  // Notification instantanée et gratuite à l'agent via Telegram (ne bloque pas la réponse en cas d'échec)
  try {
    const dashboardUrl = process.env.DASHBOARD_URL || "";
    const text =
      type === "call"
        ? `🔔 Nouvelle demande de rappel (${site})\n📞 ${phone}${dashboardUrl ? "\n" + dashboardUrl : ""}`
        : `🔔 Nouvelle question (${site})\n💬 "${question.slice(0, 300)}"${phone ? "\n📞 " + phone : "\n(pas de numéro laissé)"}${dashboardUrl ? "\n" + dashboardUrl + "#" + id : ""}`;
    const chatId = data.notifyChatId || process.env.TELEGRAM_CHAT_ID;
    await sendTelegramMessage(chatId, text);
  } catch (err) {
    console.error("Erreur envoi notification Telegram :", err);
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, id }) };
};

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn("Telegram non configuré : notification non envoyée.");
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram ${res.status}: ${errText}`);
  }
}

module.exports.sendTelegramMessage = sendTelegramMessage;
