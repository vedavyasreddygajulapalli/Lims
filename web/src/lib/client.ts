export async function downloadReport(id: string, filename: string) {
  let blob: Blob;
  if (isDemo) {
    const { demoReportPdf } = await import("../demo/adapter");
    blob = new Blob([new Uint8Array(await demoReportPdf(id))], {
      type: "application/pdf",
    });
  } else {
    const response = await fetch("/api/reports/" + id + "/pdf", {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Could not download report");
    blob = await response.blob();
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const isDemo = __DEMO__;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (isDemo) {
    const { demoRequest } = await import("../demo/adapter");
    try {
      return (await demoRequest(path, method, body)) as T;
    } catch (e) {
      const error = e as Error & {
        issues?: { path: unknown[]; message: string }[];
      };
      if (error.issues)
        throw new Error(
          error.issues
            .map((i) =>
              [i.path.join(" "), i.message].filter(Boolean).join(": "),
            )
            .join("; "),
        );
      throw e;
    }
  }
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null as T;
  const content = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      content?.error ?? "The service is unavailable. Please try again.",
    );
  return content as T;
}

export async function downloadConsolidated(id:string,filename:string){let blob:Blob;if(isDemo){const{demoConsolidatedPdf}=await import('../demo/adapter');blob=new Blob([new Uint8Array(await demoConsolidatedPdf(id))],{type:'application/pdf'});}else{const response=await fetch('/api/consolidated/'+id+'/pdf',{credentials:'same-origin'});if(!response.ok)throw new Error('Could not download consolidated report');blob=await response.blob();}const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
