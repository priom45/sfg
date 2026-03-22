import { useContext } from 'react';
import { SiteSettingsContext } from '../contexts/siteSettingsShared';

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (!context) throw new Error('useSiteSettings must be used within SiteSettingsProvider');
  return context;
}
