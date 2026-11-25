import type { SourceType, Status } from './db';

export const STATUSES: Array<{ id: Status; label: string; color: string }> = [
  { id: 'idee', label: 'Idée', color: '#9b8afb' },
  { id: 'brouillon', label: 'Brouillon', color: '#f1a208' },
  { id: 'relecture', label: 'Relecture', color: '#2e86ab' },
  { id: 'pret', label: 'Prêt', color: '#3bb273' },
  { id: 'publie', label: 'Publié', color: '#8a8f98' },
];

export const statusInfo = (s: Status) => STATUSES.find((x) => x.id === s) ?? STATUSES[1];

export const SOURCE_TYPES: Array<{ id: SourceType; label: string; icon: string }> = [
  { id: 'lien', label: 'Lien', icon: '🔗' },
  { id: 'citation', label: 'Citation', icon: '❝' },
  { id: 'contact', label: 'Contact', icon: '👤' },
  { id: 'interview', label: 'Interview', icon: '🎙' },
  { id: 'note', label: 'Note', icon: '📝' },
];

export const sourceInfo = (t: SourceType) => SOURCE_TYPES.find((x) => x.id === t) ?? SOURCE_TYPES[4];

export const RUBRIQUE_COLORS = [
  '#e4572e', '#f1a208', '#3bb273', '#2e86ab', '#a23b72', '#7768ae', '#ef476f', '#118ab2', '#06a77d', '#8a8f98',
];
