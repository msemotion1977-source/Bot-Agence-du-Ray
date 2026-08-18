const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  // Vérifie que la requête vient bien de Telegram (secret défini lors du setWebhook,
  // voir les instructions de mise en place). Évite que n'importe qui puisse appeler
  // cette adresse et injecter de faux messages "agent" dans des conversations.
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
    return { statusCode: 200, body: "ignored" }; // toujours répondre 200 à Telegram
  }

  const message = update.message;
  // On ne traite QUE les messages envoyés en "Répondre" à une de nos notifications.
  // Tout le reste (messages normaux au bot, commandes, etc.) est ignoré silencieusement.
  if (!message || !message.reply_to_message || !message.text) {
    return { statusCode: 200, body: "ignored" };
  }

  const repliedId = String(message.reply_to_message.message_id);

  try {
    const index = getStore({ name: "telegram-index", consistency: "strong" });
    const entry = await index.get(repliedId, { type: "json" });
    if (!entry || !entry.conversationId) {
      return { statusCode: 200, body: "no match" };
    }

    const store = getStore({ name: "conversations", consistency: "strong" });
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

    // Petite confirmation pour l'agent, pour qu'elle sache que c'est bien parti.
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
