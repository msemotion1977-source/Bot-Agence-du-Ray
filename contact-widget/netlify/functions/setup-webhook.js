/*!
 * À VISITER UNE SEULE FOIS DANS LE NAVIGATEUR après chaque déploiement (ou après
 * avoir changé TELEGRAM_BOT_TOKEN) :
 *
 *   https://VOTRE-SITE.netlify.app/.netlify/functions/setup-webhook?pw=VOTRE_ADMIN_PASSWORD
 *
 * Ça dit à Telegram "envoie les réponses de l'agent à cette adresse". Sans cette
 * étape, Telegram n'envoie JAMAIS rien à votre fonction telegram-webhook.js, donc
 * la fonction "Répondre" de Telegram ne peut pas marcher, même si le code est bon.
 *
 * Pour vérifier l'état actuel sans rien changer :
 *   https://VOTRE-SITE.netlify.app/.netlify/functions/setup-webhook?pw=VOTRE_ADMIN_PASSWORD&check=1
 */

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const password = qs.pw || event.headers["x-admin-password"] || event.headers["X-Admin-Password"];

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Mot de passe manquant ou incorrect. Ajoutez ?pw=VOTRE_ADMIN_PASSWORD à l'adresse."
      })
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "TELEGRAM_BOT_TOKEN manquant dans Netlify → Site settings → Environment variables." })
    };
  }

  // Vérifier l'état actuel sans rien modifier
  if (qs.check) {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const json = await res.json();
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(json, null, 2) };
  }

  // Netlify fournit automatiquement l'URL publique du site dans process.env.URL
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!siteUrl) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Impossible de déterminer l'URL du site (process.env.URL absent)." })
    };
  }

  const webhookUrl = siteUrl.replace(/\/$/, "") + "/.netlify/functions/telegram-webhook";
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  try {
    const body = { url: webhookUrl, allowed_updates: ["message"] };
    if (secret) body.secret_token = secret;

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();

    return {
      statusCode: res.ok && json.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          message: res.ok && json.ok
            ? "✅ Webhook Telegram enregistré. La fonction 'Répondre' de Telegram va maintenant marcher."
            : "❌ Échec — voir telegramResponse ci-dessous.",
          webhookUrl,
          secretUsed: !!secret,
          telegramResponse: json
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
