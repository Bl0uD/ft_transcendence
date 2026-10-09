import api from './axios'; // On importe api pour réutiliser ses en-têtes d'authentification

export async function streamAIChat(
  prompt: string,
  mode: 'ollama' | 'gemini',
  onChunk: (chunk: string | any) => void,
  onRateLimit: () => void
): Promise<void> {
  try {
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token');

    const axiosAuthHeader = api.defaults.headers.common['Authorization'] as string;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (axiosAuthHeader) {
      headers['Authorization'] = axiosAuthHeader;
    } else if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const endpoint = mode === 'gemini' 
      ? '/api/ai/gemini/stream' 
      : '/api/ai/chat/stream';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      credentials: 'include',
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
          
          if (mode === 'gemini' && parsed.text) {
             onChunk(parsed.text);
          } else {
             // Si c'est Ollama (JSON structuré)
             onChunk(parsed);
          }
        } catch {
          // Si le JSON n'est pas complet ou invalide, on passe le texte brut
          onChunk(cleanLine);
        }
      }
    }
  } catch (error: any) {
    console.error('Erreur détaillée IA:', error);
    throw error;
  }
}