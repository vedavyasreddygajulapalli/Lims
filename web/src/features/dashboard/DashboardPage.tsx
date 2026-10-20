import { tw } from "../../styles/utilities";
import {
  ArrowRight,
  ArrowUpRight,
  Users,
  ClipboardList,
  Package,
  Microscope,
  Plus,
  FlaskConical,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import type { Dashboard } from "@lims/core";
import {
  Card,
  PageHeader,
  Button,
  Loading,
  Notice,
  Empty,
  Badge,
} from "../../components/ui";
import { useQuery } from "../../lib/useQuery";
import type { Page, User } from "../../lib/types";
import { canCreate, canView } from "../../app/navigation";
const tones = [
  "#1d7568",
  "#76a89c",
  "#b5cfc3",
  "#c2aa79",
  "#98acbe",
  "#d8b7a2",
  "#b3abc4",
];
export function DashboardPage({
  navigate,
  user,
}: {
  navigate: (p: Page) => void;
  user: User;
}) {
  const { data, error, loading, reload } = useQuery<Dashboard>("/dashboard");
  return (
    <>
      <PageHeader
        eyebrow="YOUR LABORATORY, AT A GLANCE"
        title="Laboratory overview"
        description="Stay on top of samples, testing and the work that needs you."
        action={
          canCreate("samples", user) ? (
            <Button onClick={() => navigate("samples")}>
              <Plus size={16} /> Register sample
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <Notice tone="red">
          {error}{" "}
          <Button variant="ghost" onClick={reload}>
            Retry
          </Button>
        </Notice>
      ) : loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className={tw("metric-grid")}>
              {(
                [
                  {
                    key: "samples",
                    label: "Total samples",
                    icon: Package,
                    note: `${data.receipt.accepted} accepted for testing`,
                  },
                  {
                    key: "assignments",
                    label: "Tests assigned",
                    icon: Microscope,
                    note: `${data.draftObservations} with draft observations`,
                  },
                  {
                    key: "trfs",
                    label: "Test requests",
                    icon: ClipboardList,
                    note: "Across all client projects",
                  },
                  {
                    key: "clients",
                    label: "Registered clients",
                    icon: Users,
                    note: "Connected to your laboratory",
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  className={tw("metric-card")}
                  onClick={() => navigate(m.key)}
                >
                  <div>
                    <span>{m.label}</span>
                    <span className={tw("metric-icon")}>
                      <m.icon size={18} />
                    </span>
                  </div>
                  <strong>{data.counts[m.key].toLocaleString("en-IN")}</strong>
                  <p>
                    {m.note}
                    <ArrowUpRight size={14} />
                  </p>
                </button>
              ))}
            </div>
            <div className={tw("dashboard-main-grid")}>
              <Card className={tw("activity-card")}>
                <div className={tw("section-heading")}>
                  <div>
                    <h2>Sample intake</h2>
                    <p>Received over the last seven days · UTC</p>
                  </div>
                  <span className={tw("pill")}>Last 7 days</span>
                </div>
                <div className={tw("chart-legend")}>
                  <span />
                  <b>{data.days.reduce((sum, d) => sum + d.count, 0)}</b>{" "}
                  samples received
                </div>
                <div
                  className={tw("bar-chart")}
                  role="img"
                  aria-label={data.days
                    .map((d) => `${d.date}: ${d.count} samples`)
                    .join("; ")}
                >
                  <div className={tw("chart-grid")}>
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  {data.days.map((d) => (
                    <div className={tw("bar-column")} key={d.date}>
                      <span className={tw("bar-value")}>{d.count}</span>
                      <div
                        className={tw("bar-fill")}
                        style={{
                          height: `${(d.count / Math.max(...data.days.map((d) => d.count), 1)) * 138}px`,
                          minHeight: d.count ? 8 : 0,
                        }}
                      />
                      <span className={tw("bar-label")}>
                        {new Intl.DateTimeFormat("en", {
                          weekday: "short",
                          timeZone: "UTC",
                        }).format(new Date(d.date + "T00:00:00Z"))}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className={tw("material-card")}>
                <div className={tw("section-heading")}>
                  <div>
                    <h2>Material distribution</h2>
                    <p>All registered samples</p>
                  </div>
                  <FlaskConical size={18} />
                </div>
                {data.materials.length ? (
                  <>
                    <div className={tw("material-total")}>
                      <strong>{data.counts.samples}</strong>
                      <span>
                        samples across {data.materials.length} materials
                      </span>
                    </div>
                    <div className={tw("stacked-bar")} aria-hidden="true">
                      {data.materials.map((m, i) => (
                        <span
                          key={m.name}
                          style={{
                            flex: m.count,
                            background: tones[i % tones.length],
                          }}
                        />
                      ))}
                    </div>
                    <div className={tw("material-list")}>
                      {data.materials.map((m, i) => (
                        <div key={m.name}>
                          <span
                            style={{ background: tones[i % tones.length] }}
                          />
                          <b>{m.name}</b>
                          <small>
                            {Math.round(
                              (m.count / Math.max(data.counts.samples, 1)) *
                                100,
                            )}
                            %
                          </small>
                          <strong>{m.count}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty
                    title="No samples yet"
                    description="Material distribution appears after sample receipt."
                  />
                )}
              </Card>
            </div>
            <div className={tw("dashboard-bottom-grid")}>
              <Card className={tw("requests-card")}>
                <div className={tw("section-heading")}>
                  <div>
                    <h2>Recent test requests</h2>
                    <p>Your latest client work</p>
                  </div>
                  <Button variant="ghost" onClick={() => navigate("trfs")}>
                    View all <ArrowRight size={15} />
                  </Button>
                </div>
                {data.recentRequests.length ? (
                  <div className={tw("table-scroll")}>
                    <table>
                      <thead>
                        <tr>
                          <th>REQUEST</th>
                          <th>PROJECT</th>
                          <th>DUE DATE</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentRequests.map((r) => (
                          <tr key={r._id}>
                            <td>
                              <span className={tw("record-number")}>
                                {r.number}
                              </span>
                            </td>
                            <td>{r.project}</td>
                            <td>
                              {new Intl.DateTimeFormat("en-IN", {
                                day: "2-digit",
                                month: "short",
                                timeZone: "UTC",
                              }).format(new Date(r.dueDate + "T00:00:00Z"))}
                            </td>
                            <td>
                              <Button
                                variant="ghost"
                                aria-label={`Open request register for ${r.number}`}
                                onClick={() => navigate("trfs")}
                              >
                                <ArrowUpRight size={16} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title="No requests yet" />
                )}
              </Card>
              <Card className={tw("attention-card")}>
                <div className={tw("section-heading")}>
                  <div>
                    <h2>Needs attention</h2>
                    <p>A clear next step for your team</p>
                  </div>
                  <Clock3 size={18} />
                </div>
                <button
                  className={tw("attention-row")}
                  onClick={() => navigate("samples")}
                >
                  <span className={tw("attention-icon amber")}>
                    <Package size={18} />
                  </span>
                  <div>
                    <b>Samples in quarantine</b>
                    <small>Review receipt condition</small>
                  </div>
                  <strong>{data.receipt.quarantined}</strong>
                  <ArrowRight size={14} />
                </button>
                <button
                  className={tw("attention-row")}
                  onClick={() => navigate("assignments")}
                >
                  <span className={tw("attention-icon blue")}>
                    <Microscope size={18} />
                  </span>
                  <div>
                    <b>Awaiting observations</b>
                    <small>Assigned tests to start</small>
                  </div>
                  <strong>{data.assigned}</strong>
                  <ArrowRight size={14} />
                </button>
                <button
                  className={tw("attention-row")}
                  onClick={() => navigate("methods")}
                >
                  <span className={tw("attention-icon green")}>
                    <BookIcon />
                  </span>
                  <div>
                    <b>Methods awaiting source</b>
                    <small>Original sheets needed</small>
                  </div>
                  <strong>{data.methodsPending}</strong>
                  <ArrowRight size={14} />
                </button>
              </Card>
            </div>
            {canView("reference", user) && (
              <div className={tw("reference-banner")}>
                <span className={tw("reference-banner-icon")}>
                  <ShieldCheck size={24} />
                </span>
                <div>
                  <Badge tone="green">Reference workspace</Badge>
                  <h3>Test the numbers. Keep laboratory methods controlled.</h3>
                  <p>
                    Explore published concrete-cube values in a separate
                    calculator.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => navigate("reference")}
                >
                  Open reference calculator <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </>
        )
      )}
    </>
  );
}
function BookIcon() {
  return <ClipboardList size={18} />;
}
