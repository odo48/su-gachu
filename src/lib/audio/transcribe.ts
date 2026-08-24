// Ported from jarvis-brain/services/audio_service.py's transcribe(). Uses
// Groq's OpenAI-compatible Whisper endpoint directly via fetch, same as
// jarvis did with raw httpx multipart (no SDK needed for one endpoint).
const EXTENSION_BY_CONTENT_TYPE: [pattern: string, ext: string][] = [
  ['wav', 'wav'],
  ['mp4', 'mp4'],
  ['mpeg', 'mp3'],
  ['mp3', 'mp3'],
  ['ogg', 'ogg'],
  ['m4a', 'm4a'],
];

function extensionFor(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE.find(([pattern]) => contentType.includes(pattern))?.[1] ?? 'webm';
}

export async function transcribeAudio(audioData: ArrayBuffer, contentType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
  if (!audioData || audioData.byteLength === 0) throw new Error('No audio data received');

  const form = new FormData();
  form.append('file', new Blob([audioData], { type: contentType }), `speech.${extensionFor(contentType)}`);
  form.append('model', 'whisper-large-v3-turbo');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq API error: ${await res.text()}`);

  const result = await res.json();
  return result.text ?? '';
}
