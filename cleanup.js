const { getStore } = require("@netlify/blobs");

function blobsOpts(name) {
  const opts = { name, consistency: "strong" };
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    opts.siteID = process.env.BLOBS_SITE_ID;
    opts.token = process.env.BLOBS_TOKEN;
  }
  return opts;
}

// Fonction programmée (voir netlify.toml) : vide entièrement les conversations
// et l'index Telegram tous les 2 jours, pour repartir sur une base propre.
exports.handler = async () => {
  let deletedConversations = 0;
  let deletedIndex = 0;

  try {
    const store = getStore(blobsOpts("conversations"));
    const { blobs } = await store.list();
    for (const blob of blobs) {
      try {
        await store.delete(blob.key);
        deletedConversations++;
      } catch (err) {
        console.error("Erreur suppression conversation", blob.key, err && err.message ? err.message : err);
      }
    }
  } catch (err) {
    console.error("Erreur nettoyage store conversations :", err && err.message ? err.message : err);
  }

  try {
    const index = getStore(blobsOpts("telegram-index"));
    const { blobs } = await index.list();
    for (const blob of blobs) {
      try {
        await index.delete(blob.key);
        deletedIndex++;
      } catch (err) {
        console.error("Erreur suppression index", blob.key, err && err.message ? err.message : err);
      }
    }
  } catch (err) {
    console.error("Erreur nettoyage store telegram-index :", err && err.message ? err.message : err);
  }

  console.log(
    `Nettoyage terminé : ${deletedConversations} conversation(s) et ${deletedIndex} entrée(s) d'index supprimées.`
  );
  return { statusCode: 200, body: "ok" };
};
