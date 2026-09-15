import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speechRecognitionConstructor, startVoiceInput } from './voiceInput';

describe('voice input lifecycle', () => {
  let recognition;
  let session;
  let onTranscript;
  let onState;
  class Recognition {
    constructor() { recognition = this; }
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
  }
  const begin = (overrides = {}) => {
    session = startVoiceInput({ Recognition, language: 'es', onTranscript, onState, ...overrides });
    return session;
  };
  const result = (text, isFinal = true) => Object.assign([{ transcript: text }], { isFinal });

  beforeEach(() => {
    vi.useFakeTimers();
    onTranscript = vi.fn();
    onState = vi.fn();
  });
  afterEach(() => { session?.cancel(); vi.useRealTimers(); });

  it('detects standard and prefixed support, hiding insecure or unsupported contexts', () => {
    expect(speechRecognitionConstructor({})).toBeNull();
    expect(speechRecognitionConstructor({ SpeechRecognition: Recognition })).toBe(Recognition);
    expect(speechRecognitionConstructor({ webkitSpeechRecognition: Recognition })).toBe(Recognition);
    expect(speechRecognitionConstructor({ isSecureContext: false, SpeechRecognition: Recognition })).toBeNull();
  });

  it('commits final text once on completion without duplicating cumulative results', () => {
    begin();
    expect(recognition.lang).toBe('es-ES');
    recognition.onresult({ results: [result('Banco'), result('Santander', false)] });
    recognition.onresult({ results: [result('Banco'), result('Santander')] });
    expect(onTranscript).not.toHaveBeenCalled();
    recognition.onend();
    expect(onTranscript).toHaveBeenCalledOnce();
    expect(onTranscript).toHaveBeenCalledWith('Banco Santander');
    expect(onState).toHaveBeenLastCalledWith({ listening: false, error: null });
  });

  it('allows a manual stop to finish recognition and return the last result', () => {
    begin({ language: 'en' });
    expect(recognition.lang).toBe('en-GB');
    session.stop();
    expect(recognition.stop).toHaveBeenCalledOnce();
    recognition.onresult({ results: [result('  García  ')] });
    recognition.onend();
    expect(onTranscript).toHaveBeenCalledWith('García');
  });

  it('discards pending and late results when cancelled by editing or unmounting', () => {
    begin();
    const lateResult = recognition.onresult;
    const lateEnd = recognition.onend;
    recognition.onresult({ results: [result('Old name')] });
    session.cancel();
    lateResult({ results: [result('Late name')] });
    lateEnd();
    expect(onTranscript).not.toHaveBeenCalled();
    expect(recognition.abort).toHaveBeenCalledOnce();
  });

  it('cancels the previous field when another takes the microphone', () => {
    begin();
    const previous = recognition;
    const previousEnd = recognition.onend;
    previous.onresult({ results: [result('Wrong field')] });
    begin();
    expect(previous.abort).toHaveBeenCalledOnce();
    previousEnd();
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it.each(['not-allowed', 'audio-capture', 'network', 'language-not-supported'])('reports %s without replacing text', error => {
    begin();
    recognition.onerror({ error });
    expect(onState).toHaveBeenLastCalledWith({ listening: false, error });
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('reports silence and terminates sessions that never finish', () => {
    begin();
    recognition.onend();
    expect(onState).toHaveBeenLastCalledWith({ listening: false, error: 'no-speech' });
    begin();
    vi.advanceTimersByTime(30000);
    expect(onState).toHaveBeenLastCalledWith({ listening: false, error: 'timeout' });
    expect(recognition.abort).toHaveBeenCalledOnce();
  });

  it('recovers from synchronous start errors', () => {
    class DeniedRecognition extends Recognition {
      start() { throw Object.assign(new Error('Denied'), { name: 'NotAllowedError' }); }
      constructor() { super(); delete this.start; }
    }
    begin({ Recognition: DeniedRecognition });
    expect(onState).toHaveBeenLastCalledWith({ listening: false, error: 'not-allowed' });
    expect(onTranscript).not.toHaveBeenCalled();
  });
});
