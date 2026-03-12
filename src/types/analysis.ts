export type AnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'error';

export type DimensionKey =
  | 'error_handling'
  | 'test_coverage'
  | 'documentation'
  | 'security'
  | 'code_structure'
  | 'dependencies';

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DimensionScore {
  score: number;
  grade: LetterGrade;
  findings_count: number;
}

export type DimensionScores = Record<DimensionKey, DimensionScore>;

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  dimension: DimensionKey;
  severity: FindingSeverity;
  file: string | null;
  line: number | null;
  issue: string;
  evidence: string;
  fix_prompt: string;
}

export interface AnalysisMetadata {
  total_files: number;
  total_loc: number;
  languages: Record<string, number>;
  primary_language: string;
  has_package_json: boolean;
  dep_count: number;
  dev_dep_count: number;
  repo_size_mb: number;
  analysis_duration_ms: number;
}

export interface Analysis {
  id: string;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  repo_branch: string | null;
  status: AnalysisStatus;
  slop_score: number | null;
  scores: DimensionScores | null;
  verdict: string | null;
  receipts: Finding[] | null;
  metadata: AnalysisMetadata | null;
  error_message: string | null;
  analyzed_at: string | null;
  created_at: string;
}
