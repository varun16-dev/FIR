import {
  Car,
  Skull,
  ShieldAlert,
  Laptop,
  DollarSign,
  Pill,
  Flame,
  UserX,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import type { CaseClassificationType } from '../types';

export interface CaseClassificationInfo {
  type: CaseClassificationType;
  label: string;
  shortLabel: string;
  badge: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
  description: string;
  examples: string;
  defaultPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedTitlePlaceholder: string;
  protocolNotes: string;
}

export const CASE_CLASSIFICATIONS: CaseClassificationInfo[] = [
  {
    type: 'ACCIDENT',
    label: 'Accident Investigation',
    shortLabel: 'Accident',
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    icon: Car,
    description: 'Road traffic collisions, hit-and-run incidents, or industrial and workplace accidents.',
    examples: 'Motor vehicle collision, Hit-and-run, Industrial machinery failure',
    defaultPriority: 'HIGH',
    suggestedTitlePlaceholder: 'e.g. Hit-and-run collision at Outer Ring Road junction',
    protocolNotes: 'Secure CCTV footage, vehicle inspection report, breathalyzer logs, and casualty medical reports.',
  },
  {
    type: 'MURDER',
    label: 'Murder & Homicide',
    shortLabel: 'Murder / Homicide',
    badge: 'bg-red-500/15 text-red-400 border border-red-500/30',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30 hover:border-red-500/60',
    icon: Skull,
    description: 'Homicide, suspected murder, unnatural death, or severe fatal assault investigations.',
    examples: 'Suspicious homicide, Weapon assault fatality, Unnatural death scene',
    defaultPriority: 'CRITICAL',
    suggestedTitlePlaceholder: 'e.g. Homicide investigation at Sector 14 warehouse facility',
    protocolNotes: 'Cordon off primary crime scene, seal biological/DNA forensics, and log ballistic & autopsy reports.',
  },
  {
    type: 'THEFT',
    label: 'Theft & Robbery',
    shortLabel: 'Theft / Robbery',
    badge: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30 hover:border-orange-500/60',
    icon: ShieldAlert,
    description: 'Burglary, armed robbery, vehicular theft, shoplifting, or stolen physical assets.',
    examples: 'Residential burglary, Commercial robbery, Stolen vehicle recovery',
    defaultPriority: 'MEDIUM',
    suggestedTitlePlaceholder: 'e.g. Commercial break-in and inventory theft at Metro Mall',
    protocolNotes: 'Collect entry-point latent fingerprints, surveillance camera reels, and stolen item serial numbers.',
  },
  {
    type: 'CYBER_CRIME',
    label: 'Cyber Crime',
    shortLabel: 'Cyber Crime',
    badge: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/60',
    icon: Laptop,
    description: 'Ransomware, server intrusions, unauthorized access, data breach, or digital extortion.',
    examples: 'Ransomware deployment, Database exfiltration, Phishing syndicate',
    defaultPriority: 'HIGH',
    suggestedTitlePlaceholder: 'e.g. Ransomware attack compromising municipal database servers',
    protocolNotes: 'Preserve RAM memory dumps, network PCAP traces, server logs, and cryptographic disk images.',
  },
  {
    type: 'FINANCIAL_FRAUD',
    label: 'Financial Fraud',
    shortLabel: 'Financial Fraud',
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    icon: DollarSign,
    description: 'Embezzlement, banking fraud, forged financial instruments, and corporate money laundering.',
    examples: 'Shell company invoicing, Corporate embezzlement, Counterfeit negotiable notes',
    defaultPriority: 'HIGH',
    suggestedTitlePlaceholder: 'e.g. Corporate embezzlement of Rs 2.5 Cr via falsified supplier accounts',
    protocolNotes: 'Extract bank statements, certified ledger audits, authorized signatory records, and invoice receipts.',
  },
  {
    type: 'NARCOTICS',
    label: 'Narcotics & Drugs',
    shortLabel: 'Narcotics',
    badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30 hover:border-purple-500/60',
    icon: Pill,
    description: 'Illicit substance smuggling, contraband trafficking, or controlled substance manufacturing.',
    examples: 'Contraband seizure at port, Distribution syndicate, Synthetic drug lab',
    defaultPriority: 'HIGH',
    suggestedTitlePlaceholder: 'e.g. Interception of synthetic narcotics consignment at rail terminal',
    protocolNotes: 'Maintain strict sealed chain-of-custody for chemical lab purity test and weigh-in certificates.',
  },
  {
    type: 'ASSAULT',
    label: 'Assault & Violent Crime',
    shortLabel: 'Assault',
    badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30 hover:border-rose-500/60',
    icon: Flame,
    description: 'Aggravated physical assault, violent confrontation, battery, or armed intimidation.',
    examples: 'Street confrontation, Armed weapon threat, Domestic battery incident',
    defaultPriority: 'HIGH',
    suggestedTitlePlaceholder: 'e.g. Aggravated physical assault outside public transit station',
    protocolNotes: 'Secure medical examination certificates (MLC), weapon seizure memo, and eyewitness affidavits.',
  },
  {
    type: 'MISSING_PERSON',
    label: 'Missing Person',
    shortLabel: 'Missing Person',
    badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30 hover:border-blue-500/60',
    icon: UserX,
    description: 'Missing adult, missing child, suspected abduction, or unverified disappearance.',
    examples: 'Missing juvenile report, Suspicious sudden disappearance, Abduction trace',
    defaultPriority: 'HIGH',
    suggestedTitlePlaceholder: 'e.g. Disappearance investigation of individual last sighted at CP',
    protocolNotes: 'Log last-seen telecom tower pings, transit CCTV records, and recent transit card history.',
  },
  {
    type: 'GENERAL',
    label: 'General / Other Incident',
    shortLabel: 'General',
    badge: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30 hover:border-slate-500/60',
    icon: FolderOpen,
    description: 'Standard investigation, public nuisance, municipal violation, or uncategorized case.',
    examples: 'Regulatory compliance review, Civil complaint verification, Miscellaneous FIR',
    defaultPriority: 'MEDIUM',
    suggestedTitlePlaceholder: 'e.g. Investigation regarding unverified incident log',
    protocolNotes: 'Ensure primary complaint copy and initial inquiry diary entry are catalogued.',
  },
];

export function getCaseClassification(type?: string): CaseClassificationInfo {
  if (!type) return CASE_CLASSIFICATIONS[CASE_CLASSIFICATIONS.length - 1];
  const normalized = type.toUpperCase().trim();
  // Map HOMICIDE to MURDER if needed
  if (normalized === 'HOMICIDE') {
    return CASE_CLASSIFICATIONS.find((c) => c.type === 'MURDER') || CASE_CLASSIFICATIONS[1];
  }
  const found = CASE_CLASSIFICATIONS.find((c) => c.type === normalized);
  return found || CASE_CLASSIFICATIONS[CASE_CLASSIFICATIONS.length - 1];
}
