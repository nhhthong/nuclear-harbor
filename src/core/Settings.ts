import type { QualityPreset } from '@/config/tunables';
import type { EventBus } from './EventBus';
import type { GameEvents } from './events';
import { DEFAULT_BINDINGS, type Bindings } from './InputManager';

/** GDD 10: minimum settings = mouse sensitivity, volume, graphics quality, FPS cap. */
export interface SettingsData {
  mouseSensitivity: number;
  masterVolume: number;
  quality: QualityPreset;
  /** 0 = uncapped (vsync). */
  fpsCap: 0 | 30 | 60 | 120;
  bindings: Bindings;
}

export const DEFAULT_SETTINGS: SettingsData = {
  mouseSensitivity: 1,
  masterVolume: 0.8,
  quality: 'medium',
  fpsCap: 0,
  bindings: DEFAULT_BINDINGS,
};

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'nuclear-harbor.settings.v1';

function cloneDefaults(): SettingsData {
  return {
    ...DEFAULT_SETTINGS,
    bindings: Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS.bindings).map(([action, codes]) => [action, [...codes]]),
    ) as Bindings,
  };
}

/**
 * Persistent user settings (GDD 14: LocalStorage). Reads are synchronous through `get`, writes
 * through `set` which persists and emits `settings:changed`.
 */
export class Settings {
  private data: SettingsData = cloneDefaults();

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly store: KeyValueStore | null,
  ) {
    this.load();
  }

  get<K extends keyof SettingsData>(key: K): SettingsData[K] {
    return this.data[key];
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    this.save();
    this.events.emit('settings:changed', { key });
  }

  snapshot(): Readonly<SettingsData> {
    return this.data;
  }

  resetToDefaults(): void {
    this.data = cloneDefaults();
    this.save();
    for (const key of Object.keys(this.data)) this.events.emit('settings:changed', { key });
  }

  private load(): void {
    if (!this.store) return;
    try {
      const raw = this.store.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      const defaults = cloneDefaults();
      this.data = {
        ...defaults,
        ...parsed,
        // new actions added after a save was written keep their default binding
        bindings: { ...defaults.bindings, ...(parsed.bindings ?? {}) },
      };
    } catch {
      this.data = cloneDefaults();
    }
  }

  private save(): void {
    if (!this.store) return;
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // storage full / blocked (private mode): settings stay in memory only
    }
  }
}

/** localStorage, or null when unavailable (tests, privacy modes). */
export function safeLocalStorage(): KeyValueStore | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__nh_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}
