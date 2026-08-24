/**
 * Groq Whisper STT — port from jarvis-brain/services/audio_service.py
 * Transcribes audio blobs to text via Groq's Whisper large-v3-turbo model.
 */

export async function transcribeAudio(
  audioData: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

  // Map content-type → file extension (same logic as Python service)
  const extMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a',
  };
  const ext = Object.entries(extMap).find(([k]) => contentType.includes(k))?.[1] ?? 'webm';
  const filename = `speech.${ext}`;

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([audioData], { type: contentType }),
    filename
  );
  formData.append('model', 'whisper-large-v3-turbo');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq STT error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return (data.text as string) ?? '';
}
