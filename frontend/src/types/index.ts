export type DesignStyle =
  | "Modern"
  | "Minimalist"
  | "Luxury"
  | "Scandinavian"
  | "Gaming Room";

export type JobStatus =
  | "pending"
  | "analyzing"
  | "planning"
  | "sourcing"
  | "rendering"
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

export interface MatchedProduct {
  product_id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  image_url: string;
  image_base64?: string;
  product_url: string;
  store: string;
  slot: string;
  description?: string;
}

export interface DesignProposal {
  image_prompt?: string;
  design_rationale: string;
  generated_image_url: string;
  generated_image_b64?: string;
  revised_prompt?: string;
  render_steps?: string[];
  intermediate_images?: string[];
  intermediate_products?: string[];
  matched_products: MatchedProduct[];
  suggestions: MatchedProduct[];
  total_price: number;
  decor_description?: string;
}

export interface AnalysisResponse {
  job_id: string;
  room_analysis: RoomAnalysis;
  status: JobStatus;
}

export interface SourcingResponse {
  job_id: string;
  room_analysis: RoomAnalysis;
  design_plan: {
    suggestions: Array<{
      item_type: string;
      description: string;
      placement: string;
      colors: string[];
      style_vibe: string;
      specific_details: string;
      is_replacement: boolean;
      target_furniture: string;
    }>;
    overall_vision: string;
  };
  sourced_products: MatchedProduct[];
  status: JobStatus;
}

export interface DesignResponse {
  job_id: string;
  room_analysis: RoomAnalysis;
  design_proposal: DesignProposal;
  sourced_products: MatchedProduct[];
  alternative_products: MatchedProduct[];
  status: JobStatus;
}
