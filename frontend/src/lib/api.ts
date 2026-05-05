import type {
  AnalysisResponse,
  DesignResponse,
  DesignStyle,
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

/** Step 2 — send style + keep-list, get back rendered image */
export async function generateDesign(
  jobId: string,
  style: DesignStyle,
  furnitureToKeep: string[],
  userNotes: string
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
