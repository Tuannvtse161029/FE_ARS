import type { LucideIcon } from 'lucide-react';
import {
  Atom, Award, BarChart3, Beaker, BookOpen, Brain, Calculator, Clipboard,
  Code2, Dna, FileChartColumn, FileSearch, FlaskConical, Globe2, GraduationCap,
  Landmark, Library, Lightbulb, Microscope, Network, Orbit, PenTool, Pi, Radio,
  ScanSearch, Search, Sigma, Sparkles, Telescope, Waypoints,
} from 'lucide-react';

export interface AvatarOption {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  color: string;
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  ['atom', Atom, '#007AFF'], ['award', Award, '#D97706'], ['chart', BarChart3, '#047857'],
  ['beaker', Beaker, '#7C3AED'], ['book', BookOpen, '#B45309'], ['brain', Brain, '#DB2777'],
  ['calculator', Calculator, '#2563EB'], ['clipboard', Clipboard, '#0F766E'], ['code', Code2, '#4F46E5'],
  ['dna', Dna, '#059669'], ['file-chart', FileChartColumn, '#C2410C'], ['file-search', FileSearch, '#0369A1'],
  ['flask', FlaskConical, '#9333EA'], ['globe', Globe2, '#0891B2'], ['graduation', GraduationCap, '#1D4ED8'],
  ['landmark', Landmark, '#92400E'], ['library', Library, '#166534'], ['bulb', Lightbulb, '#CA8A04'],
  ['microscope', Microscope, '#BE123C'], ['network', Network, '#4338CA'], ['orbit', Orbit, '#0E7490'],
  ['pen', PenTool, '#9D174D'], ['pi', Pi, '#6D28D9'], ['radio', Radio, '#0369A1'],
  ['scan', ScanSearch, '#15803D'], ['search', Search, '#1E40AF'], ['sigma', Sigma, '#A21CAF'],
  ['sparkles', Sparkles, '#B45309'], ['telescope', Telescope, '#334155'], ['waypoints', Waypoints, '#0F766E'],
].map(([id, icon, color]) => ({ id: id as string, labelKey: `profile.avatar.option.${id}`, icon: icon as LucideIcon, color: color as string }));
