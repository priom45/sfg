import { createContext } from 'react';
import type { SiteSettings } from '../types';

export interface SiteSettingsContextType {
  settings: SiteSettings | null;
  loading: boolean;
  schemaMissing: boolean;
  refreshSettings: () => Promise<boolean>;
}

export const SiteSettingsContext = createContext<SiteSettingsContextType | null>(null);
