exports.handler = async (event, context) => {
  // Ici, vous récupérez currentKey depuis une variable d'environnement ou un module partagé
  const currentKey = process.env.CURRENT_KEY || "fallback_key"; // Définissez votre logique
  return {
    statusCode: 200,
    body: JSON.stringify({ key: currentKey }),
  };
};
