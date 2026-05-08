import type {
  AnalysisResponse,
  DesignResponse,
  DesignStyle,
  SourcingResponse,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Step 1 — upload image, get back furniture list */
export async function uploadRoom(file: File): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    body: form,
  });
  return handleResponse<AnalysisResponse>(res);
}

/** Step 2A — Plan + Source: get sourced products for preview */
export async function sourceProducts(
  jobId: string,
  style: DesignStyle,
  furnitureToKeep: string[],
  userNotes: string,
  maxBudget?: number
): Promise<SourcingResponse> {
  const res = await fetch(
    `${BASE_URL}/api/source-products?job_id=${jobId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desired_style: style,
        furniture_to_keep: furnitureToKeep,
        user_notes: userNotes,
        max_budget: maxBudget ?? null,
      }),
    }
  );
  return handleResponse<SourcingResponse>(res);
}

/** Step 2B — Render: iteratively edit original image with the confirmed products */
export async function renderDesign(jobId: string): Promise<DesignResponse> {
  const res = await fetch(
    `${BASE_URL}/api/render-design?job_id=${jobId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  return handleResponse<DesignResponse>(res);
}

/** Legacy — full pipeline in one call */
export async function generateDesign(
  jobId: string,
  style: DesignStyle,
  furnitureToKeep: string[],
  userNotes: string,
  maxBudget?: number
): Promise<DesignResponse> {
  const res = await fetch(
    `${BASE_URL}/api/generate-design?job_id=${jobId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desired_style: style,
        furniture_to_keep: furnitureToKeep,
        user_notes: userNotes,
        max_budget: maxBudget ?? null,
      }),
    }
  );
  return handleResponse<DesignResponse>(res);
}

/** Smart Replace — swap one product and re-render */
export async function smartReplace(
  jobId: string,
  slot: string,
  newProductId: string
): Promise<DesignResponse> {
  const res = await fetch(
    `${BASE_URL}/api/smart-replace?job_id=${jobId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot,
        new_product_id: newProductId,
      }),
    }
  );
  return handleResponse<DesignResponse>(res);
}

/** Poll job status (for background / full-pipeline flow) */
export async function pollJob(jobId: string): Promise<DesignResponse> {
  const res = await fetch(`${BASE_URL}/api/job/${jobId}`);
  return handleResponse<DesignResponse>(res);
}
