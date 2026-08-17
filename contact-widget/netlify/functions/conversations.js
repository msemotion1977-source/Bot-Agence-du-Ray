const { getStore } = require("@netlify/blobs");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-password"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  const password = event.headers["x-admin-password"] || event.headers["X-Admin-Password"];
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Non autorisé" }) };
  }

  const store = getStore({ name: "conversations", consistency: "strong" });
  const { blobs } = await store.list();
  const conversations = await Promise.all(
    blobs.map(async (b) => {
      try {
        return await store.get(b.key, { type: "json" });
      } catch (e) {
        return null;
      }
    })
  );

  const cleaned = conversations
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ conversations: cleaned }) };
};
