import type { PublicationPaper } from '../types/publication';

/**
 * Single discipline-specific rubric item returned by the resolver.
 *
 * Pre-2026-09 these were rendered as passive reference strings; the
 * reviewer now scores each item (1..maxScore) and writes notes, just like
 * the 5 standard criteria. The `code` comes from the BE's grading rubric
 * and identifies the item in the BE's SpecializedEvaluationItem array.
 */
export interface SpecializedItem {
  code: string;
  title: string;
  description: string;
  /** e.g. 5 for Engineering rubric, 10 for general. */
  maxScore: number;
  standardReferences: string[];
}

/**
 * Resolved discipline-specific criteria for a paper.
 *
 * `items` is the primary field — an ordered array of rubric items
 * from the sub-field's gradingRubric[]. Each item is an evaluable
 * criterion: the reviewer scores it (1..maxScore) and writes notes.
 *
 * The 3-item legacy shape (criteria1/2/3 + evaluationCriteria1/2/3) is
 * retained for the adapter's stringifyRubricReference pass; it maps
 * items[0..2] into those slots so the BE's legacy DetailedEvaluation
 * columns are populated alongside the modern specializedEvaluation[].
 */
export interface SpecializedCriteriaBundle {
  items: SpecializedItem[];

  // Legacy 3-item shape — used by adapter.stringifyRubricReference()
  criteria1: string;
  expandedCriteria1: string;
  evaluationCriteria1: FormattedRubricReference;

  criteria2: string;
  expandedCriteria2: string;
  evaluationCriteria2: FormattedRubricReference;

  criteria3: string;
  expandedCriteria3: string;
  evaluationCriteria3: FormattedRubricReference;
}

export interface FormattedRubricReference {
  maxScore: number;
  standardReferences: string[];
}

export interface SubFieldGradingRubricItem {
  code?: string | null;
  title?: string | null;
  description?: string | null;
  maxScore?: number | null;
  order?: number | null;
  standardReferences?: string[] | null;
}

export interface SubFieldEntity {
  subFieldId?: number;
  name?: string | null;
  majorFieldName?: string | null;
  description?: string | null;
  gradingRubric?: SubFieldGradingRubricItem[] | null;
}

/**
 * Domain-specific preset rubrics for subfields / topics when database rubrics are incomplete
 * or paper has no subFieldId explicitly linked.
 */
/**
 * Domain-preset shape: only the fields a preset needs to describe its
 * three fallback criteria. The full `SpecializedCriteriaBundle` is
 * derived from this in `resolveCriteriaForPaper`.
 */
interface DomainPreset {
  criteria1: string;
  expandedCriteria1: string;
  evaluationCriteria1: FormattedRubricReference;

  criteria2: string;
  expandedCriteria2: string;
  evaluationCriteria2: FormattedRubricReference;

  criteria3: string;
  expandedCriteria3: string;
  evaluationCriteria3: FormattedRubricReference;
}

const DOMAIN_CRITERIA_PRESETS: Record<string, DomainPreset> = {
  ai_machine_learning: {
    criteria1: 'Dataset Integrity, Preprocessing & Ethical Fairness',
    expandedCriteria1:
      'Evaluate dataset quality, statistical distribution, bias mitigation, data labeling reliability, and ethical sourcing compliance.',
    evaluationCriteria1: {
      maxScore: 10,
      standardReferences: [
        'Statistical baseline validation',
        'FAIR Guiding Principles (2016)',
        'IEEE Ethics in AI',
      ],
    },

    criteria2: 'Model Architecture, Algorithmic Novelty & Convergence',
    expandedCriteria2:
      'Evaluate mathematical rigor, novelty of algorithmic design, parameter efficiency, ablation study depth, and training stability.',
    evaluationCriteria2: {
      maxScore: 10,
      standardReferences: [
        'Empirical ablation proofs',
        'Baseline comparison benchmarks',
        'Convergence verification',
      ],
    },

    criteria3: 'Empirical Generalizability & Code/Artifact Reproducibility',
    expandedCriteria3:
      'Evaluate out-of-distribution evaluation, robustness against adversarial shift, hyperparameter sensitivity, and openness of replication package.',
    evaluationCriteria3: {
      maxScore: 10,
      standardReferences: [
        'ISO/IEC 25010:2023',
        'Open Science reproducibility guidelines',
        'Cross-validation metrics',
      ],
    },
  },

  cybersecurity: {
    criteria1: 'Threat Modeling, Attack Surface & Vulnerability Analysis',
    expandedCriteria1:
      'Evaluate comprehensive identification of threat actors, attack vectors, trust boundaries, and system vulnerabilities.',
    evaluationCriteria1: {
      maxScore: 10,
      standardReferences: [
        'NIST Cybersecurity Framework (CSF) 2.0',
        'STRIDE threat taxonomy',
      ],
    },

    criteria2: 'Cryptographic Correctness & Defensive Mechanism Efficacy',
    expandedCriteria2:
      'Evaluate mathematical security proofs, cryptographic implementation resistance, and defensive mechanism bypass prevention.',
    evaluationCriteria2: {
      maxScore: 10,
      standardReferences: [
        'ISO/IEC 27001:2022',
        'NIST SP 800-53',
        'FIPS validation',
      ],
    },

    criteria3: 'Incident Resilience, Containment & Safe Disclosure Protocols',
    expandedCriteria3:
      'Evaluate containment speed, fail-secure behavior under breach, forensic auditability, and responsible vulnerability disclosure adherence.',
    evaluationCriteria3: {
      maxScore: 10,
      standardReferences: [
        'ISO/IEC 29147 (Vulnerability disclosure)',
        'NIST CSF 2.0 response metrics',
      ],
    },
  },

  software_systems: {
    criteria1: 'Software Architecture, Modularity & Scalability',
    expandedCriteria1:
      'Evaluate structural cohesion, decoupling, fault isolation, and horizontal/vertical scalability under high concurrent throughput.',
    evaluationCriteria1: {
      maxScore: 10,
      standardReferences: [
        'ISO/IEC 25010:2023 System Quality',
        'Architectural Pattern Compliance',
      ],
    },

    criteria2: 'Verification, Test Coverage & Performance Benchmarking',
    expandedCriteria2:
      'Evaluate automated testing rigor, unit/integration/stress coverage, latency bounds, and resource consumption profiles.',
    evaluationCriteria2: {
      maxScore: 10,
      standardReferences: [
        'IEEE 829 Standard for Software Test Documentation',
        'Reproducible benchmarking',
      ],
    },

    criteria3: 'Maintainability, API Documentation & Deployment Reproducibility',
    expandedCriteria3:
      'Evaluate code readability, API contract specification, containerization scripts, and long-term evolutionary maintainability.',
    evaluationCriteria3: {
      maxScore: 10,
      standardReferences: [
        'OpenAPI 3.0 / ISO/IEC 19770',
        'Docker/OCI reproducible builds',
      ],
    },
  },

  computer_networks: {
    criteria1: 'Network Protocol Conformance & Topology Architecture',
    expandedCriteria1:
      'Evaluate protocol correctness, interoperability with existing standards, packet format validity, and routing efficiency.',
    evaluationCriteria1: {
      maxScore: 10,
      standardReferences: ['IETF RFC standards', 'IEEE 802 architectural models'],
    },

    criteria2: 'Throughput, Latency & Network Congestion Resilience',
    expandedCriteria2:
      'Evaluate bandwidth utilization, packet loss rates under heavy load, queuing mechanisms, and QoS parameter guarantees.',
    evaluationCriteria2: {
      maxScore: 10,
      standardReferences: [
        'RFC 2544 Network Interconnect Benchmarking',
        'Jitter measurement protocols',
      ],
    },

    criteria3: 'Network Reliability, Security & Failover Robustness',
    expandedCriteria3:
      'Evaluate convergence time during link disruption, protection against DDoS/spoofing attacks, and multi-path failover.',
    evaluationCriteria3: {
      maxScore: 10,
      standardReferences: [
        'NIST Cybersecurity Framework 2.0',
        'Carrier-grade availability benchmarks',
      ],
    },
  },

  biomedical_health: {
    criteria1: 'Clinical / Biological Validity & Study Design Rigor',
    expandedCriteria1:
      'Evaluate mechanistic plausibility, hypothesis grounding, control group selection, and statistical sample size justification.',
    evaluationCriteria1: {
      maxScore: 10,
      standardReferences: [
        'CONSORT / STARD reporting guidelines',
        'Biomedical validity benchmarks',
      ],
    },

    criteria2: 'Ethical Compliance, Patient Privacy & Consent Protocol',
    expandedCriteria2:
      'Evaluate Institutional Review Board (IRB) approvals, patient de-identification, biosafety protocols, and data governance.',
    evaluationCriteria2: {
      maxScore: 10,
      standardReferences: [
        'Declaration of Helsinki',
        'HIPAA/GDPR health data privacy rules',
      ],
    },

    criteria3: 'Statistical Power, Replication & Cross-Cohort Validation',
    expandedCriteria3:
      'Evaluate statistical power calculation, multiple testing correction, effect size reporting, and independent cohort verification.',
    evaluationCriteria3: {
      maxScore: 10,
      standardReferences: [
        'Cochrane Handbook for Systematic Reviews',
        'p-value adjustment standards',
      ],
    },
  },

  general_research: {
    criteria1: 'Theoretical Foundation & Conceptual Framework',
    expandedCriteria1:
      'Evaluate theoretical grounding, coherence of fundamental assumptions, and depth of literature contextualization.',
    evaluationCriteria1: {
      maxScore: 10,
      standardReferences: [
        'Academic rigor',
        'Scholarly citation balance',
        'Epistemological validity',
      ],
    },

    criteria2: 'Methodological Execution & Analytical Soundness',
    expandedCriteria2:
      'Evaluate validity of empirical instruments, qualitative/quantitative data analysis rigor, and mitigation of confounding factors.',
    evaluationCriteria2: {
      maxScore: 10,
      standardReferences: [
        'Internal & external validity metrics',
        'Triangulation of empirical evidence',
      ],
    },

    criteria3: 'Practical Utility, Broader Impact & Ethical Integrity',
    expandedCriteria3:
      'Evaluate translational relevance, policy implications, societal benefits, conflict of interest disclosure, and ethical compliance.',
    evaluationCriteria3: {
      maxScore: 10,
      standardReferences: [
        'UNESCO Recommendation on Open Science (2021)',
        'Academic ethical codes',
      ],
    },
  },
};

/**
 * Auto-detect domain key from text.
 */
function detectDomain(text: string): keyof typeof DOMAIN_CRITERIA_PRESETS {
  const lower = text.toLowerCase();
  if (
    lower.includes('ai') ||
    lower.includes('intelligence') ||
    lower.includes('machine learning') ||
    lower.includes('deep learning') ||
    lower.includes('neural') ||
    lower.includes('nlp') ||
    lower.includes('vision')
  ) {
    return 'ai_machine_learning';
  }
  if (
    lower.includes('security') ||
    lower.includes('cyber') ||
    lower.includes('crypt') ||
    lower.includes('malware') ||
    lower.includes('attack') ||
    lower.includes('vulnerability')
  ) {
    return 'cybersecurity';
  }
  if (
    lower.includes('network') ||
    lower.includes('protocol') ||
    lower.includes('routing') ||
    lower.includes('packet') ||
    lower.includes('wireless') ||
    lower.includes('5g') ||
    lower.includes('iot')
  ) {
    return 'computer_networks';
  }
  if (
    lower.includes('software') ||
    lower.includes('system') ||
    lower.includes('architecture') ||
    lower.includes('database') ||
    lower.includes('distributed') ||
    lower.includes('cloud')
  ) {
    return 'software_systems';
  }
  if (
    lower.includes('health') ||
    lower.includes('medical') ||
    lower.includes('bio') ||
    lower.includes('clinical') ||
    lower.includes('disease') ||
    lower.includes('drug')
  ) {
    return 'biomedical_health';
  }
  return 'general_research';
}

/**
 * Resolves the 6 Criteria & ExpandedCriteria for a given paper:
 * 1. Checks if SubField has database-persisted gradingRubric items.
 * 2. If present, maps rubric[0..2] to criteria1..3, expandedCriteria1..3, evaluationCriteria1..3.
 * 3. If incomplete or missing, auto-generates rigorous specialized criteria matching the paper's domain.
 */
export function resolveCriteriaForPaper(
  paper?: Partial<PublicationPaper> | null,
  subField?: SubFieldEntity | null,
): SpecializedCriteriaBundle {
  const rubric = subField?.gradingRubric;

  // Helper: convert a single rubric item to a SpecializedItem.
  // Uses the BE-provided code if available, falls back to a generated one.
  const rubricToItem = (item: SubFieldGradingRubricItem, index: number): SpecializedItem => ({
    code: item.code?.trim() || `SPECIALIZED_${index + 1}`,
    title: item.title?.trim() || `Domain Criterion ${index + 1}`,
    description: item.description?.trim() || 'Evaluate this criterion using the standards and max score provided.',
    maxScore: item.maxScore ?? 10,
    standardReferences: Array.isArray(item.standardReferences)
      ? item.standardReferences.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      : [],
  });

  // 1. Build items[] from the rubric if available.
  if (Array.isArray(rubric) && rubric.length > 0) {
    const items = rubric.map(rubricToItem);
    const [r1, r2, r3] = items;
    return {
      items,
      // Legacy 3-item shape for adapter.stringifyRubricReference():
      criteria1: r1.title,
      expandedCriteria1: r1.description,
      evaluationCriteria1: { maxScore: r1.maxScore, standardReferences: r1.standardReferences },
      criteria2: r2?.title ?? '',
      expandedCriteria2: r2?.description ?? '',
      evaluationCriteria2: r2 ? { maxScore: r2.maxScore, standardReferences: r2.standardReferences } : { maxScore: 10, standardReferences: [] },
      criteria3: r3?.title ?? '',
      expandedCriteria3: r3?.description ?? '',
      evaluationCriteria3: r3 ? { maxScore: r3.maxScore, standardReferences: r3.standardReferences } : { maxScore: 10, standardReferences: [] },
    };
  }

  // 2. No rubric from BE — fall back to domain-preset (3 items).
  const textContext = [
    subField?.name,
    subField?.description,
    paper?.title,
    paper?.abstract,
    paper?.field,
    paper?.subfield,
  ]
    .filter(Boolean)
    .join(' ');

  const presetKey = detectDomain(textContext);
  const fallback = DOMAIN_CRITERIA_PRESETS[presetKey];

  // Build items[] from the 3 fallback criteria.
  const fallbackItems: SpecializedItem[] = [
    { code: 'SPECIALIZED_1', title: fallback.criteria1, description: fallback.expandedCriteria1, maxScore: fallback.evaluationCriteria1.maxScore, standardReferences: fallback.evaluationCriteria1.standardReferences },
    { code: 'SPECIALIZED_2', title: fallback.criteria2, description: fallback.expandedCriteria2, maxScore: fallback.evaluationCriteria2.maxScore, standardReferences: fallback.evaluationCriteria2.standardReferences },
    { code: 'SPECIALIZED_3', title: fallback.criteria3, description: fallback.expandedCriteria3, maxScore: fallback.evaluationCriteria3.maxScore, standardReferences: fallback.evaluationCriteria3.standardReferences },
  ];

  return {
    items: fallbackItems,
    criteria1: fallback.criteria1,
    expandedCriteria1: fallback.expandedCriteria1,
    evaluationCriteria1: fallback.evaluationCriteria1,
    criteria2: fallback.criteria2,
    expandedCriteria2: fallback.expandedCriteria2,
    evaluationCriteria2: fallback.evaluationCriteria2,
    criteria3: fallback.criteria3,
    expandedCriteria3: fallback.expandedCriteria3,
    evaluationCriteria3: fallback.evaluationCriteria3,
  };
}