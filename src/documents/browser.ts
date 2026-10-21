import { parseRecording, type Recording } from '../domain/recording';

/**
 * Demo data bundled into the static build: document texts and recorded runs. Nothing is fetched
 * at runtime, so the recorded demo works from any static host or inside an iframe.
 */
const texts = import.meta.glob<string>('../../documents/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const recordings = import.meta.glob<unknown>('../../recordings/*.json', {
  import: 'default',
  eager: true,
});

const idOf = (path: string) => path.replace(/^.*\//, '').replace(/\.(txt|json)$/, '');

const TEXT_BY_ID = new Map(Object.entries(texts).map(([p, t]) => [idOf(p), t]));
const RECORDING_BY_ID = new Map(
  Object.entries(recordings).map(([p, r]) => [idOf(p), parseRecording(r)]),
);

export function documentText(id: string): string {
  const text = TEXT_BY_ID.get(id);
  if (text === undefined) throw new Error(`No text for document ${id}.`);
  return text;
}

export function recordedRun(id: string): Recording {
  const rec = RECORDING_BY_ID.get(id);
  if (!rec) throw new Error(`No recording for document ${id}.`);
  return rec;
}
