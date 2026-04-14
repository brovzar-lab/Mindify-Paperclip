import OpenAI from 'openai';
import { OPENAI_API_KEY } from './config';

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
  return _client;
}

/**
 * Transcribe audio bytes via OpenAI Whisper.
 *
 * @param audioBytes - Raw audio buffer (m4a, mp3, webm, wav, etc.)
 * @param filename   - Filename hint used by Whisper's content-type detection.
 */
export async function transcribeAudio(
  audioBytes: Buffer,
  filename: string,
): Promise<string> {
  const file = await OpenAI.toFile(audioBytes, filename);

  const response = await client().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    // Temperature 0 — deterministic output aids downstream classification
    // and makes prompt caching on the Claude side more effective across
    // near-identical transcripts.
    temperature: 0,
  });

  return response.text.trim();
}
