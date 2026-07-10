const { io } = require("socket.io-client");

// Ton token valide (actuellement lié au User ID 7)
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWxsb0BnbWFpbC5jb20iLCJpYXQiOjE3ODM1MjkyMzYsImV4cCI6MTc4MzUzMjgzNn0.7aGMcljoc6GT9P9al5GqyWy6abhbjh-6WFplGGoA9j8"; 

console.log("🔌 Tentative de connexion au namespace /chat...");

// Connexion directe au namespace
const socket = io("http://127.0.0.1:3000/chat", {
  auth: { token: TOKEN },
  transports: ['websocket']
});

socket.on("connect", () => {
  console.log("✅ Connecté au serveur ! ID:", socket.id);
  setTimeout(() => {
        console.log('Fin du test');
        socket.disconnect();
    }, 5000);
  
  // Exemple d'action une fois connecté
  socket.emit("joinChannel", { channelId: 1 });
});

socket.on("onMessage", (data) => {
  console.log("📥 Message reçu :", data);
});

socket.on("connect_error", (err) => {
  console.error("❌ Erreur de connexion :", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Déconnecté du serveur. Raison :", reason);
});

// Permet de fermer proprement la connexion quand tu fais Ctrl+C
process.on('SIGINT', () => {
  socket.disconnect();
  process.exit();
});