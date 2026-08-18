/** Shared API types mirroring contracts/openapi.yaml.
 *
 * Single source of truth for both the Web (`apps/frontend`) and Miniapp
 * (`apps/miniapp`) frontends. When the contract changes, update this file —
 * both consumers re-export it.
 */

export interface Child {
  id: number;
  name: string;
  submission_count: number;
  created_at: string;
}

export interface SubmissionAccepted {
  submission_id: number;
  status: string;
}

export interface ScoreSummary {
  correct: number;
  total: number;
}

export interface GradedQuestion {
  id: number;
  question_number: string;
  question_position: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  question_image_path: string | null;
  question_type: string;
  is_correct: boolean;
  question_text: string | null;
  question_latex: string | null;
  solution_note: string | null;
  error_category: string | null;
  is_manually_fixed: boolean;
}

export interface Submission {
  id: number;
  child_id: number;
  child_name: string;
  subject: "english" | "math";
  status: "pending" | "processing" | "completed" | "failed";
  score: ScoreSummary | null;
  thumbnail_url: string | null;
  created_at: string;
  original_image_url: string;
  annotated_image_url: string | null;
  total_questions: number | null;
  correct_count: number | null;
  token_usage: Record<string, number> | null;
  questions: GradedQuestion[] | null;
  updated_at: string | null;
}

export interface SubmissionSummary {
  id: number;
  child_id: number;
  child_name: string;
  subject: "english" | "math";
  status: "pending" | "processing" | "completed" | "failed";
  score: ScoreSummary | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface SubmissionListResponse {
  items: SubmissionSummary[];
  total: number;
}

export interface ErrorQuestionItem {
  id: number;
  submission_id: number;
  child_id: number;
  child_name: string;
  subject: "english" | "math";
  question_number: string;
  question_type: string;
  question_image_path: string;
  question_text: string | null;
  question_latex: string | null;
  solution_note: string | null;
  error_category: string | null;
  error_count: number;
  error_timestamps: string[];
  is_manually_fixed: boolean;
  last_error_at: string;
  created_at: string;
}

export interface ErrorCollectionListResponse {
  items: ErrorQuestionItem[];
  total: number;
}

export interface FixQuestionResponse {
  question: GradedQuestion;
  new_score: ScoreSummary;
}

export interface GenerateSheetResponse {
  image_url: string;
  question_count: number;
}

// ── Auth (SMS verification-code login) ─────────────

export interface SendCodeResponse {
  retry_after: number;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  expires_at: string;
  user_id: number;
}
