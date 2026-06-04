import type { LocalizedString } from '../../../sdk/types';

export interface SpyfallRole {
  id: string;
  name: LocalizedString;
}

export interface SpyfallLocation {
  id: string;
  name: LocalizedString;
  icon?: string;
  roles: SpyfallRole[];
}

export interface SpyfallPack {
  id: string;
  name: LocalizedString;
  version: number;
  locations: SpyfallLocation[];
}
