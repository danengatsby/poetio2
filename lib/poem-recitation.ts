export type SpeechSegment = { text: string; pauseAfter: number };
export type RecitationState = { status: 'idle' | 'playing' | 'paused' | 'ended' | 'error'; completed: number };

// Short utterances keep long poems within speech-engine text limits. Line and
// stanza boundaries receive a little silence without changing the saved text.
export function speechSegments(title: string, content: string): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  for (const [index, line] of [title, ...content.split(/\r?\n/)].entries()) {
    let remaining = line.trim();
    if (!remaining) {
      if (segments.length) segments[segments.length - 1].pauseAfter = 650;
      continue;
    }
    while (remaining) {
      const head = Array.from(remaining).slice(0, 220).join('');
      const boundary = remaining.length > head.length ? head.lastIndexOf(' ') : -1;
      const length = boundary > 0 ? boundary : head.length;
      segments.push({ text: remaining.slice(0, length), pauseAfter: 0 });
      remaining = remaining.slice(length).trimStart();
    }
    segments[segments.length - 1].pauseAfter = index === 0 ? 500 : 180;
  }
  return segments;
}

export function languageVoices(voices: SpeechSynthesisVoice[], language: string) {
  const normalize = (value: string) => value.toLowerCase().replaceAll('_', '-');
  const locale = normalize(language);
  return voices.filter(voice => normalize(voice.lang).split('-')[0] === locale.split('-')[0])
    .sort((a, b) => Number(normalize(b.lang) === locale) - Number(normalize(a.lang) === locale)
      || Number(b.default) - Number(a.default) || a.name.localeCompare(b.name));
}

export class PoemRecitation {
  private state: RecitationState = { status: 'idle', completed: 0 };
  private utterance: SpeechSynthesisUtterance | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private disposed = false;
  private voice: SpeechSynthesisVoice | null = null;
  private rate = 0.9;

  constructor(
    private synth: Pick<SpeechSynthesis, 'speak' | 'cancel'>,
    private createUtterance: (text: string) => SpeechSynthesisUtterance,
    private segments: SpeechSegment[],
    private language: string,
    private onChange: (state: RecitationState) => void,
  ) {}

  private update(status: RecitationState['status'], completed = this.state.completed) {
    this.state = { status, completed };
    if (!this.disposed) this.onChange(this.state);
  }

  private cancelCurrent() {
    this.generation++;
    clearTimeout(this.timer);
    if (this.utterance) {
      this.utterance.onstart = this.utterance.onend = this.utterance.onerror = null;
      this.utterance = null;
      this.synth.cancel();
    }
  }

  play(voice: SpeechSynthesisVoice, rate: number) {
    if (this.disposed || this.state.status === 'playing') return;
    const completed = this.state.status === 'paused' ? this.state.completed : 0;
    this.cancelCurrent();
    this.voice = voice;
    this.rate = rate;
    this.update('playing', completed);
    this.speakNext();
  }

  private speakNext() {
    if (this.disposed || this.state.status !== 'playing') return;
    const segment = this.segments[this.state.completed];
    if (!segment) { this.update('ended', this.segments.length); return; }
    const generation = ++this.generation;
    const current = () => !this.disposed && generation === this.generation;
    const fail = () => {
      if (!current()) return;
      this.cancelCurrent();
      this.update('error');
    };
    try {
      const utterance = this.createUtterance(segment.text);
      this.utterance = utterance; // Keep a strong reference until speech ends.
      utterance.lang = this.language;
      utterance.voice = this.voice;
      utterance.rate = this.rate;
      utterance.onstart = () => { if (current()) clearTimeout(this.timer); };
      utterance.onerror = fail;
      utterance.onend = () => {
        if (!current()) return;
        this.generation++;
        clearTimeout(this.timer);
        this.utterance = null;
        const completed = this.state.completed + 1;
        this.update(completed === this.segments.length ? 'ended' : 'playing', completed);
        if (this.state.status === 'playing') this.timer = setTimeout(() => this.speakNext(), segment.pauseAfter);
      };
      this.timer = setTimeout(fail, 15000);
      this.synth.speak(utterance);
    } catch { fail(); }
  }

  pause() {
    if (this.disposed || this.state.status !== 'playing') return;
    // Cancel and replay the interrupted fragment on resume. This also works on
    // engines that don't implement native pause/resume consistently.
    this.cancelCurrent();
    this.update('paused');
  }

  stop() {
    if (this.disposed) return;
    this.cancelCurrent();
    this.update('idle', 0);
  }

  dispose() {
    this.disposed = true;
    this.cancelCurrent();
  }
}
