export interface DashboardInput {
  clients: number;
  trfs: number;
  samples: { material: string; receiptStatus: string; createdAt: string }[];
  assignments: { status: string }[];
  methodsPending: number;
  recentRequests: {
    _id: string;
    number: string;
    project: string;
    dueDate: string;
  }[];
}
export function summarizeDashboard(input: DashboardInput, now = new Date()) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - 6 + i);
    return { date: date.toISOString().slice(0, 10), count: 0 };
  });
  const materials: Record<string, number> = {};
  const receipt = { accepted: 0, quarantined: 0, rejected: 0 };
  for (const sample of input.samples) {
    materials[sample.material] = (materials[sample.material] ?? 0) + 1;
    if (sample.receiptStatus in receipt)
      receipt[sample.receiptStatus as keyof typeof receipt]++;
    const day = days.find((d) => d.date === sample.createdAt.slice(0, 10));
    if (day) day.count++;
  }
  return {
    counts: {
      clients: input.clients,
      trfs: input.trfs,
      samples: input.samples.length,
      assignments: input.assignments.length,
    },
    receipt,
    materials: Object.entries(materials).map(([name, count]) => ({
      name,
      count,
    })),
    days,
    draftObservations: input.assignments.filter(
      (a) => a.status === "observations_draft",
    ).length,
    assigned: input.assignments.filter((a) => a.status === "assigned").length,
    methodsPending: input.methodsPending,
    recentRequests: input.recentRequests,
    timezone: "UTC",
  };
}
export type Dashboard = ReturnType<typeof summarizeDashboard>;
