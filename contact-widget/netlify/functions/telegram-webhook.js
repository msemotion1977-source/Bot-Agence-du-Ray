const { getStore } = require("@netlify/blobs");

function blobsOpts(name) {
  const opts = { name, consistency: "strong" };
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    opts.siteID = process.env.BLOBS_SITE_ID;
    opts.token = process.env.BLOBS_TOKEN;
  }
  return opts;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const gotSecret =
    event.headers["x-telegram-bot-api-secret-token"] || event.headers["X-Telegram-Bot-Api-Secret-Token"];
  if (secret && gotSecret !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  let update;
  try {
    update = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 200, body: "ignored" };
  }

  const message = update.message;
  if (!message || !message.reply_to_message || !message.text) {
    return { statusCode: 200, body: "ignored" };
  }

  const repliedId = String(message.reply_to_message.message_id);

  try {
    const index = getStore(blobsOpts("telegram-index"));
    const entry = await index.get(repliedId, { type: "json" });
    if (!entry || !entry.conversationId) {
      return { statusCode: 200, body: "no match" };
    }

    const store = getStore(blobsOpts("conversations"));
    const conversation = await store.get(entry.conversationId, { type: "json" });
    if (!conversation) {
      return { statusCode: 200, body: "conversation gone" };
    }

    conversation.messages = conversation.messages || [];
    conversation.messages.push({ from: "agent", text: message.text, at: new Date().toISOString() });
    conversation.status = "answered";
    conversation.repliedAt = new Date().toISOString();
    conversation.updatedAt = new Date().toISOString();
    await store.setJSON(entry.conversationId, conversation);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = message.chat && message.chat.id;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Envoyé au visiteur.",
          reply_to_message_id: message.message_id
        })
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Erreur traitement réponse Telegram :", err && err.message ? err.message : err);
  }

  return { statusCode: 200, body: "ok" };
};
