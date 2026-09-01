import type { PublicationPaper } from '../types/publication';

export interface SpecializedCriteriaBundle {
  criteria1: string;
  expandedCriteria1: string;
  evaluationCriteria1: string;

  criteria2: string;
  expandedCriteria2: string;
  evaluationCriteria2: string;

  criteria3: string;
  expandedCriteria3: string;
  evaluationCriteria3: string;
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
const DOMAIN_CRITERIA_PRESETS: Record<string, SpecializedCriteriaBundle> = {
  ai_machine_learning: {
    criteria1: 'Dataset Integrity, Preprocessing & Ethical Fairness',
    expandedCriteria1:
      'Evaluate dataset quality, statistical distribution, bias mitigation, data labeling reliability, and ethical sourcing compliance.',
    evaluationCriteria1:
      'Standard: Statistical baseline validation, FAIR Guiding Principles (2016), IEEE Ethics in AI.',

    criteria2: 'Model Architecture, Algorithmic Novelty & Convergence',
    expandedCriteria2:
      'Evaluate mathematical rigor, novelty of algorithmic design, parameter efficiency, ablation study depth, and training stability.',
    evaluationCriteria2:
      'Standard: Empirical ablation proofs, baseline comparison benchmarks, convergence verification.',

    criteria3: 'Empirical Generalizability & Code/Artifact Reproducibility',
    expandedCriteria3:
      'Evaluate out-of-distribution evaluation, robustness against adversarial shift, hyperparameter sensitivity, and openness of replication package.',
    evaluationCriteria3:
      'Standard: ISO/IEC 25010:2023, Open Science reproducibility guidelines, cross-validation metrics.',
  },

  cybersecurity: {
    criteria1: 'Threat Modeling, Attack Surface & Vulnerability Analysis',
    expandedCriteria1:
      'Evaluate comprehensive identification of threat actors, attack vectors, trust boundaries, and system vulnerabilities.',
    evaluationCriteria1:
      'Standard: NIST Cybersecurity Framework (CSF) 2.0, STRIDE threat taxonomy.',

    criteria2: 'Cryptographic Correctness & Defensive Mechanism Efficacy',
    expandedCriteria2:
      'Evaluate mathematical security proofs, cryptographic implementation resistance, and defensive mechanism bypass prevention.',
    evaluationCriteria2:
      'Standard: ISO/IEC 27001:2022, NIST SP 800-53, FIPS validation.',

    criteria3: 'Incident Resilience, Containment & Safe Disclosure Protocols',
    expandedCriteria3:
      'Evaluate containment speed, fail-secure behavior under breach, forensic auditability, and responsible vulnerability disclosure adherence.',
    evaluationCriteria3:
      'Standard: ISO/IEC 29147 (Vulnerability disclosure), NIST CSF 2.0 response metrics.',
  },

  software_systems: {
    criteria1: 'Software Architecture, Modularity & Scalability',
    expandedCriteria1:
      'Evaluate structural cohesion, decoupling, fault isolation, and horizontal/vertical scalability under high concurrent throughput.',
    evaluationCriteria1:
      'Standard: ISO/IEC 25010:2023 System Quality, Architectural Pattern Compliance.',

    criteria2: 'Verification, Test Coverage & Performance Benchmarking',
    expandedCriteria2:
      'Evaluate automated testing rigor, unit/integration/stress coverage, latency bounds, and resource consumption profiles.',
    evaluationCriteria2:
      'Standard: IEEE 829 Standard for Software Test Documentation, reproducible benchmarking.',

    criteria3: 'Maintainability, API Documentation & Deployment Reproducibility',
    expandedCriteria3:
      'Evaluate code readability, API contract specification, containerization scripts, and long-term evolutionary maintainability.',
    evaluationCriteria3:
      'Standard: OpenAPI 3.0 / ISO/IEC 19770, Docker/OCI reproducible builds.',
  },

  computer_networks: {
    criteria1: 'Network Protocol Conformance & Topology Architecture',
    expandedCriteria1:
      'Evaluate protocol correctness, interoperability with existing standards, packet format validity, and routing efficiency.',
    evaluationCriteria1:
      'Standard: IETF RFC standards, IEEE 802 architectural models.',

    criteria2: 'Throughput, Latency & Network Congestion Resilience',
    expandedCriteria2:
      'Evaluate bandwidth utilization, packet loss rates under heavy load, queuing mechanisms, and QoS parameter guarantees.',
    evaluationCriteria2:
      'Standard: RFC 2544 Network Interconnect Benchmarking, jitter measurement protocols.',

    criteria3: 'Network Reliability, Security & Failover Robustness',
    expandedCriteria3:
      'Evaluate convergence time during link disruption, protection against DDoS/spoofing attacks, and multi-path failover.',
    evaluationCriteria3:
      'Standard: NIST Cybersecurity Framework 2.0, Carrier-grade availability benchmarks.',
  },

  biomedical_health: {
    criteria1: 'Clinical / Biological Validity & Study Design Rigor',
    expandedCriteria1:
      'Evaluate mechanistic plausibility, hypothesis grounding, control group selection, and statistical sample size justification.',
    evaluationCriteria1:
      'Standard: CONSORT / STARD reporting guidelines, biomedical validity benchmarks.',

    criteria2: 'Ethical Compliance, Patient Privacy & Consent Protocol',
    expandedCriteria2:
      'Evaluate Institutional Review Board (IRB) approvals, patient de-identification, biosafety protocols, and data governance.',
    evaluationCriteria2:
      'Standard: Declaration of Helsinki, HIPAA/GDPR health data privacy rules.',

    criteria3: 'Statistical Power, Replication & Cross-Cohort Validation',
    expandedCriteria3:
      'Evaluate statistical power calculation, multiple testing correction, effect size reporting, and independent cohort verification.',
    evaluationCriteria3:
      'Standard: Cochrane Handbook for Systematic Reviews, p-value adjustment standards.',
  },

  general_research: {
    criteria1: 'Theoretical Foundation & Conceptual Framework',
    expandedCriteria1:
      'Evaluate theoretical grounding, coherence of fundamental assumptions, and depth of literature contextualization.',
    evaluationCriteria1:
      'Standard: Academic rigor, scholarly citation balance, epistemological validity.',

    criteria2: 'Methodological Execution & Analytical Soundness',
    expandedCriteria2:
      'Evaluate validity of empirical instruments, qualitative/quantitative data analysis rigor, and mitigation of confounding factors.',
    evaluationCriteria2:
      'Standard: Internal & external validity metrics, triangulation of empirical evidence.',

    criteria3: 'Practical Utility, Broader Impact & Ethical Integrity',
    expandedCriteria3:
      'Evaluate translational relevance, policy implications, societal benefits, conflict of interest disclosure, and ethical compliance.',
    evaluationCriteria3:
      'Standard: UNESCO Recommendation on Open Science (2021), academic ethical codes.',
  },
};

/**
 * Format standard references into a readable summary string for evaluationCriteria.
 */
const formatRubricReferences = (
  item?: SubFieldGradingRubricItem | null,
  fallbackScore = 10,
): string => {
  if (!item) return `Max Score: ${fallbackScore} | Academic Peer Review Standard`;
  const refs = Array.isArray(item.standardReferences) && item.standardReferences.length > 0
    ? item.standardReferences.join(', ')
    : 'International Academic Peer-Review Standards';
  return `Thang điểm: ${item.maxScore ?? fallbackScore} | Quy chuẩn: ${refs}`;
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

  // If subfield has at least 3 rubric items in database:
  if (Array.isArray(rubric) && rubric.length >= 3) {
    return {
      criteria1: rubric[0].title?.trim() || 'Specialized Domain Criterion 1',
      expandedCriteria1: rubric[0].description?.trim() || 'Evaluation of primary specialized criterion.',
      evaluationCriteria1: formatRubricReferences(rubric[0]),

      criteria2: rubric[1].title?.trim() || 'Specialized Domain Criterion 2',
      expandedCriteria2: rubric[1].description?.trim() || 'Evaluation of secondary specialized criterion.',
      evaluationCriteria2: formatRubricReferences(rubric[1]),

      criteria3: rubric[2].title?.trim() || 'Specialized Domain Criterion 3',
      expandedCriteria3: rubric[2].description?.trim() || 'Evaluation of tertiary specialized criterion.',
      evaluationCriteria3: formatRubricReferences(rubric[2]),
    };
  }

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

  return {
    criteria1: rubric?.[0]?.title?.trim() || fallback.criteria1,
    expandedCriteria1: rubric?.[0]?.description?.trim() || fallback.expandedCriteria1,
    evaluationCriteria1: rubric?.[0] ? formatRubricReferences(rubric[0]) : fallback.evaluationCriteria1,

    criteria2: rubric?.[1]?.title?.trim() || fallback.criteria2,
    expandedCriteria2: rubric?.[1]?.description?.trim() || fallback.expandedCriteria2,
    evaluationCriteria2: rubric?.[1] ? formatRubricReferences(rubric[1]) : fallback.evaluationCriteria2,

    criteria3: rubric?.[2]?.title?.trim() || fallback.criteria3,
    expandedCriteria3: rubric?.[2]?.description?.trim() || fallback.expandedCriteria3,
    evaluationCriteria3: rubric?.[2] ? formatRubricReferences(rubric[2]) : fallback.evaluationCriteria3,
  };
}
