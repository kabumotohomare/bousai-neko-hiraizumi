import { defaultLocalProgress, LocalProgress, LocalProgressSchema } from '../../domain/session/model';

const STORAGE_KEY = 'bousaiNeko.progress';

export function loadLocalProgress(): LocalProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultLocalProgress;
    }

    return LocalProgressSchema.parse(JSON.parse(raw));
  } catch {
    return defaultLocalProgress;
  }
}

export function saveLocalProgress(progress: LocalProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
