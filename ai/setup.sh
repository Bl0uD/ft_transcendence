#!/bin/sh

# 1. Démarrer le serveur Ollama en arrière-plan
ollama serve &

# 2. Attendre que le serveur soit opérationnel
echo "⏳ Attente du démarrage de l'IA..."
until ollama list > /dev/null 2>&1; do
  sleep 2
done

# 3. Télécharger le modèle souhaité (ex: llama3, llama3.2, ou tinyllama)
echo "📥 Téléchargement du modèle IA..."

# Alternatives modles IA
# tinyllama (~600 Mo) : Ultra rapide, consomme très peu de RAM.
# gemma:2b (~1.4 Go) : Très bon compromis vitesse/réponses.
# llama3 (~4.7 Go) : Plus intelligent mais nécessite plus de ressources.

ollama pull llama3

echo "✅ Le conteneur IA est prêt !"

# 4. Conserver le processus principal en vie
wait