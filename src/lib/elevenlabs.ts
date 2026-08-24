/**
 * ElevenLabs TTS — port from jarvis-brain/services/audio_service.py
 * Converts text to speech using ElevenLabs streaming API.
 */

const ELEVENLABS_VOICE_ID = 'cjVigY5qzO86Huf0OWal'; // Eric voice
const ELEVENLABS_MODEL = 'eleven_v3';

export async function textToSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');
  if (!text?.trim()) throw new Error('Text is required for TTS');

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        output_format: 'mp3_44100_128',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS error ${response.status}: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
