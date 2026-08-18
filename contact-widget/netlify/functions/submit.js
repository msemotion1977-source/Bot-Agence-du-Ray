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
  const visitorId = (data.visitorId || "").toString().trim().slice(0, 80) || null;
  if (type === "call" && !phone) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Phone required for call" };
  }
  if (type === "question" && !question) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Question required" };
  }

  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
  const firstMessageText = type === "call" ? `Je souhaite être rappelé(e) au ${phone}` : question;
  const nowIso = new Date().toISOString();

  const conversation = {
    id,
    visitorId,
    createdAt: nowIso,
    updatedAt: nowIso,
    site,
    pageUrl,
    type,
    phone: phone || null,
    status: "new",
    telegramMessageId: null,
    messages: [{ from: "visitor", text: firstMessageText, at: nowIso }]
  };

  // Sauvegarde en base : ne doit JAMAIS faire planter toute la fonction.
  let storageOk = true;
  const store = getStore({ name: "conversations", consistency: "strong" });
  try {
    await store.setJSON(id, conversation);
  } catch (err) {
    storageOk = false;
    console.error("Erreur d'écriture Netlify Blobs :", err && err.message ? err.message : err);
  }

  // Notification instantanée à l'agent via Telegram (ne bloque pas la réponse en cas d'échec)
  try {
    const dashboardUrl = process.env.DASHBOARD_URL || "";
    const text =
      type === "call"
        ? `🔔 Nouvelle demande de rappel (${site})\n📞 ${phone}${dashboardUrl ? "\n" + dashboardUrl : ""}\n\nRépondez directement à ce message (fonction "Répondre" de Telegram) pour discuter avec le visiteur.`
        : `🔔 Nouvelle question (${site})\n💬 "${question.slice(0, 300)}"${phone ? "\n📞 " + phone : "\n(pas de numéro laissé)"}${dashboardUrl ? "\n" + dashboardUrl + "#" + id : ""}\n\nRépondez directement à ce message (fonction "Répondre" de Telegram) pour discuter avec le visiteur.`;
    const chatId = data.notifyChatId || process.env.TELEGRAM_CHAT_ID;
    const tgResult = await sendTelegramMessage(chatId, text);
    if (tgResult && tgResult.message_id) {
      conversation.telegramMessageId = tgResult.message_id;
      if (storageOk) {
        try {
          await store.setJSON(id, conversation);
          const index = getStore({ name: "telegram-index", consistency: "strong" });
          await index.setJSON(String(tgResult.message_id), { conversationId: id });
        } catch (err) {
          console.error("Erreur indexation Telegram :", err && err.message ? err.message : err);
        }
      }
    }
  } catch (err) {
    console.error("Erreur envoi notification Telegram :", err && err.message ? err.message : err);
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, id, storageOk }) };
};

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn("Telegram non configuré : notification non envoyée.");
    return null;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.ok) {
    throw new Error(`Telegram ${res.status}: ${json ? JSON.stringify(json) : "réponse invalide"}`);
  }
  return json.result; // contient message_id, utile pour le threading des réponses
}
module.exports.sendTelegramMessage = sendTelegramMessage;const { getStore } = require("@netlify/blobs");
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
  const visitorId = (data.visitorId || "").toString().trim().slice(0, 80) || null;
  if (type === "call" && !phone) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Phone required for call" };
  }
  if (type === "question" && !question) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Question required" };
  }

  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
  const firstMessageText = type === "call" ? `Je souhaite être rappelé(e) au ${phone}` : question;
  const nowIso = new Date().toISOString();

  const conversation = {
    id,
    visitorId,
    createdAt: nowIso,
    updatedAt: nowIso,
    site,
    pageUrl,
    type,
    phone: phone || null,
    status: "new",
    telegramMessageId: null,
    messages: [{ from: "visitor", text: firstMessageText, at: nowIso }]
  };

  // Sauvegarde en base : ne doit JAMAIS faire planter toute la fonction.
  let storageOk = true;
  const store = getStore({ name: "conversations", consistency: "strong" });
  try {
    await store.setJSON(id, conversation);
  } catch (err) {
    storageOk = false;
    console.error("Erreur d'écriture Netlify Blobs :", err && err.message ? err.message : err);
  }

  // Notification instantanée à l'agent via Telegram (ne bloque pas la réponse en cas d'échec)
  try {
    const dashboardUrl = process.env.DASHBOARD_URL || "";
    const text =
      type === "call"
        ? `🔔 Nouvelle demande de rappel (${site})\n📞 ${phone}${dashboardUrl ? "\n" + dashboardUrl : ""}\n\nRépondez directement à ce message (fonction "Répondre" de Telegram) pour discuter avec le visiteur.`
        : `🔔 Nouvelle question (${site})\n💬 "${question.slice(0, 300)}"${phone ? "\n📞 " + phone : "\n(pas de numéro laissé)"}${dashboardUrl ? "\n" + dashboardUrl + "#" + id : ""}\n\nRépondez directement à ce message (fonction "Répondre" de Telegram) pour discuter avec le visiteur.`;
    const chatId = data.notifyChatId || process.env.TELEGRAM_CHAT_ID;
    const tgResult = await sendTelegramMessage(chatId, text);
    if (tgResult && tgResult.message_id) {
      conversation.telegramMessageId = tgResult.message_id;
      if (storageOk) {
        try {
          await store.setJSON(id, conversation);
          const index = getStore({ name: "telegram-index", consistency: "strong" });
          await index.setJSON(String(tgResult.message_id), { conversationId: id });
        } catch (err) {
          console.error("Erreur indexation Telegram :", err && err.message ? err.message : err);
        }
      }
    }
  } catch (err) {
    console.error("Erreur envoi notification Telegram :", err && err.message ? err.message : err);
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, id, storageOk }) };
};

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn("Telegram non configuré : notification non envoyée.");
    return null;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.ok) {
    throw new Error(`Telegram ${res.status}: ${json ? JSON.stringify(json) : "réponse invalide"}`);
  }
  return json.result; // contient message_id, utile pour le threading des réponses
}
module.exports.sendTelegramMessage = sendTelegramMessage;const { getStore } = require("@netlify/blobs");
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

  // Sauvegarde en base : ne doit JAMAIS faire planter toute la fonction.
  // Si Netlify Blobs a un souci, on logue l'erreur mais on continue quand même
  // (l'agent recevra la notification Telegram même si l'historique dashboard échoue).
  let storageOk = true;
  try {
    const store = getStore({ name: "conversations", consistency: "strong" });
    await store.setJSON(id, conversation);
  } catch (err) {
    storageOk = false;
    console.error("Erreur d'écriture Netlify Blobs :", err && err.message ? err.message : err);
  }

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
    console.error("Erreur envoi notification Telegram :", err && err.message ? err.message : err);
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, id, storageOk }) };
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
