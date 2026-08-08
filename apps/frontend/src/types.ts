/** Shared types matching the OpenAPI contract. */

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
