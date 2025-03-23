const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

exports.handler = async (event, context) => {
  const params = event.queryStringParameters;
  const encodedUserId = params.userId;
  if (!encodedUserId) {
    return { statusCode: 400, body: "ID utilisateur manquant !" };
  }
  let userId;
  try {
    userId = Buffer.from(encodedUserId, "base64").toString("utf8");
  } catch (err) {
    return { statusCode: 400, body: "Format d'ID invalide !" };
  }
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM user_data WHERE user_id = ?", [userId], (err, row) => {
      if (err) {
        console.error("Erreur DB:", err.message);
        return resolve({ statusCode: 500, body: "Erreur interne." });
      }
      resolve({ statusCode: 200, body: JSON.stringify({ verified: !!row }) });
    });
  });
};
