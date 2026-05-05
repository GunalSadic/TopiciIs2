export type DesignStyle =
  | "Modern"
  | "Minimalist"
  | "Luxury"
  | "Scandinavian"
  | "Gaming Room";

export type JobStatus =
  | "pending"
  | "analyzing"
  | "designing"
  | "completed"
  | "failed";

export interface DetectedFurniture {
  name: string;
  keep: boolean;
  condition: "good" | "fair" | "poor";
  estimated_position: string;
}

export interface RoomAnalysis {
  room_type: string;
  detected_furniture: DetectedFurniture[];
  spatial_notes: string;
  lighting: string;
  raw_description: string;
}

export interface DesignProposal {
  image_prompt: string;
  design_rationale: string;
  generated_image_url: string;
  revised_prompt: string;
}

export interface AnalysisResponse {
  job_id: string;
  room_analysis: RoomAnalysis;
  status: JobStatus;
}

export interface DesignResponse {
  job_id: string;
  room_analysis: RoomAnalysis;
  design_proposal: DesignProposal;
  status: JobStatus;
}
