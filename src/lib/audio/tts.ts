// Ported from jarvis-brain/services/audio_service.py's text_to_speech().
// Same voice/model jarvis used ("Eric"), called via the plain REST endpoint
// instead of the elevenlabs SDK — one call doesn't need a whole dependency.
const VOICE_ID = 'cjVigY5qzO86Huf0OWal';
const MODEL_ID = 'eleven_v3';

export async function textToSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured.');
  if (!text || !text.trim()) throw new Error('Text is required for TTS');

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL_ID }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS generation failed: ${await res.text()}`);

  return res.arrayBuffer();
}
