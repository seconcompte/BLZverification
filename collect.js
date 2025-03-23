const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

// Ouvrir (ou créer) la base de données SQLite
const db = new sqlite3.Database("./database.db");

// Vous pouvez aussi recréer ici la gestion dynamique de la clé secrète  
// (mais pour simplifier, imaginez que votre clé est disponible via une variable d'environnement ou une autre fonction partagée)
let currentKey = process.env.CURRENT_KEY;  // ou importez-la d’un module partagé
let previousKey = process.env.PREVIOUS_KEY;

exports.handler = async (event, context) => {
  // Récupérer les paramètres depuis l'URL
  const params = event.queryStringParameters;
  const ip = (event.headers["x-forwarded-for"] || event.headers["remote_addr"] || "").split(",")[0].trim();

  if (!params.userId) {
    return { statusCode: 400, body: "ID utilisateur manquant !" };
  }
  
  let userId;
  try {
    userId = Buffer.from(params.userId, "base64").toString("utf8");
  } catch (err) {
    return { statusCode: 400, body: "Format d'ID invalide !" };
  }
  
  const key = params.key;
  const from = params.from;
  const userAgent = event.headers["user-agent"] || "";
  
  console.log(`Requête reçue : IP=${ip}, userId=${userId}, key=${key}, from=${from}, userAgent=${userAgent}`);

  // Bloquer les requêtes des bots Discord
  if (userAgent.includes("Discordbot")) {
    console.log("Requête ignorée car elle provient de Discordbot.");
    return { statusCode: 204, body: "" };
  }
  
  // Vérifier la clé et le paramètre "from"
  if (!key || (key !== currentKey && key !== previousKey) || !from || from !== "bot") {
    console.log("Clé invalide");
    return { statusCode: 403, body: "Clé périmée ou invalide. Veuillez régénérer un lien." };
  }
  
  // Empêcher la re‑vérification
  const userExists = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM user_data WHERE user_id = ?", [userId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  }).catch(err => {
    console.error("DB Error:", err.message);
    return null;
  });
  
  if (userExists) {
    return { statusCode: 403, body: "Vous êtes déjà vérifié !" };
  }
  
  const hashedIP = crypto.createHash("sha256").update(ip).digest("hex");
  
  // Vérifier les doubles comptes, puis insérer
  const existingRows = await new Promise((resolve, reject) => {
    db.all("SELECT * FROM user_data WHERE hashed_ip = ?", [hashedIP], (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  }).catch(err => {
    console.error("DB Error:", err.message);
    return [];
  });
  
  let notification = "";
  if (existingRows.length > 0) {
    if (existingRows.length === 1) {
      notification = `<@${userId}> est un alt de <@${existingRows[0].user_id}>.`;
    } else {
      const others = existingRows.map(r => `<@${r.user_id}> (${r.user_id})`).join("\n");
      notification = `<@${userId}> est un double compte de <@${existingRows[0].user_id}>.\nLes comptes suivants lui appartiennent également :\n${others}`;
    }
    // Ici, vous pourriez envoyer une notification (via webhook par exemple) si vous le souhaitez.
  }
  
  // Insérer l'enregistrement dans la base (même si c'est un double, pour la recherche).
  await new Promise((resolve, reject) => {
    db.run("INSERT INTO user_data (hashed_ip, user_id) VALUES (?, ?)", [hashedIP, userId], (err) => {
      if (err) reject(err);
      resolve();
    });
  }).catch(err => {
    console.error("Erreur lors de l'insertion:", err.message);
    return { statusCode: 500, body: "Erreur lors de l'enregistrement." };
  });
  
  if (existingRows.length === 0) {
    return { statusCode: 200, body: "Enregistrement réussi." };
  } else {
    return { statusCode: 200, body: `Enregistrement réussi. Cependant, ${notification}` };
  }
};
