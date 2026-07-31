import api from './axios'; // On importe api pour réutiliser ses en-têtes d'authentification

export async function streamAIChat(
  prompt: string,
  onChunk: (chunk: string) => void,
  onRateLimit: () => void
): Promise<void> {
  try {
    // 1. Récupération du token depuis localStorage ou les headers par défaut d’Axios
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token');

    const axiosAuthHeader = api.defaults.headers.common['Authorization'] as string;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // On applique le header Authorization s'il existe
    if (axiosAuthHeader) {
      headers['Authorization'] = axiosAuthHeader;
    } else if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    // 2. Requête Fetch configurée avec authentification et support des cookies
    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers,
      credentials: 'include', // Permet d'envoyer les cookies (JWT/session) si utilisé
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (response.status === 429) {
      onRateLimit();
      throw new Error('Rate limit exceeded');
    }

    if (response.status === 401) {
      throw new Error('Non autorisé (401) : Veuillez vous reconnecter.');
    }

    if (!response.ok || !response.body) {
      throw new Error("Erreur lors de la communication avec l'IA.");
    }

    // 3. Traitement du flux SSE
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanLine = line.replace(/^data:\s*/, '').trim();

        if (!cleanLine || cleanLine === '[DONE]') continue;

        try {
          const parsed = JSON.parse(cleanLine);
          const chunk = parsed.delta ?? parsed.chunk ?? parsed.content;

          if (chunk !== undefined) {
            onChunk(chunk);
          }
        } catch {
          onChunk(cleanLine);
        }
      }
    }
  } catch (error: any) {
    console.error('Erreur détaillée IA:', error);
    throw error;
  }
}