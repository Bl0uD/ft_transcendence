import { io } from 'socket.io-client';

// Remplace localhost:3000 par l'URL de ton back-end si elle est différente.
// Note le "/chat" à la fin : il correspond au namespace défini dans ton ChatGateway !
const SOCKET_URL = 'http://localhost:3000/chat';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // On désactive la connexion auto pour attendre d'avoir le token de l'utilisateur
});