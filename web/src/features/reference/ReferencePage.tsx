import { tw } from "../../styles/utilities";
import { useState, type FormEvent } from "react";
import {
  Calculator,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  referenceSource,
  type referenceStrength,
  type verifyReference,
} from "@lims/core";
import {
  Card,
  PageHeader,
  Button,
  Badge,
  Field,
  Notice,
  Loading,
} from "../../components/ui";
import { request } from "../../lib/client";
import { useQuery } from "../../lib/useQuery";
type Result = ReturnType<typeof referenceStrength>;
export function ReferencePage() {
  const { data, loading, error } = useQuery<{
    checks: ReturnType<typeof verifyReference>;
  }>("/reference");
  const [load, setLoad] = useState("519.3"),
    [area, setArea] = useState("22500"),
    [result, setResult] = useState<Result | null>(null),
    [validation, setValidation] = useState(""),
    [busy, setBusy] = useState(false);
  async function calculate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setValidation("");
    try {
      setResult(
        await request<Result>("/reference/calculate", "POST", {
          loadKn: load,
          areaMm2: area,
        }),
      );
    } catch (e) {
      setValidation((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ISOLATED REFERENCE WORKSPACE"
        title="Check the calculation"
        description="Explore published concrete-cube values without changing laboratory records."
        action={<Badge tone="amber">Reference only</Badge>}
      />
      <div className={tw("reference-layout")}>
        <Card className={tw("calculator-card")}>
          <div className={tw("section-heading")}>
            <span className={tw("large-icon")}>
              <Calculator size={23} />
            </span>
            <div>
              <h2>Cube compressive strength</h2>
              <p>Load ÷ loaded area</p>
            </div>
          </div>
          <div className={tw("formula-display")}>
            <span>
              f<sub>c</sub>
            </span>
            <span>=</span>
            <div>
              <span>Failure load (kN) × 1000</span>
              <hr />
              <span>Loaded area (mm²)</span>
            </div>
          </div>
          <form onSubmit={calculate}>
            <div className={tw("form-grid")}>
              <Field
                label="Failure load · kN"
                value={load}
                inputMode="decimal"
                required
                onChange={(e) => {
                  setLoad(e.target.value);
                  setResult(null);
                }}
              />
              <Field
                label="Loaded area · mm²"
                value={area}
                inputMode="decimal"
                required
                onChange={(e) => {
                  setArea(e.target.value);
                  setResult(null);
                }}
              />
            </div>
            <div className={tw("form-actions")}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLoad("519.3");
                  setArea("22500");
                  setResult(null);
                  setValidation("");
                }}
              >
                <RotateCcw size={15} /> Reset
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Calculating…" : "Calculate reference"}
                <ArrowRight size={16} />
              </Button>
            </div>
          </form>
          {validation && <Notice tone="red">{validation}</Notice>}
          {result && (
            <div className={tw("calculation-result")} aria-live="polite">
              <span>REFERENCE RESULT</span>
              <strong>
                {result.displayed}
                <small>{result.unit}</small>
              </strong>
              <p>
                {result.rounding} · Source fixture {result.sourceVersion}
              </p>
              <details>
                <summary>View exact arithmetic</summary>
                <code>
                  {result.exactNumerator} ÷ {result.exactDenominator}
                </code>
              </details>
            </div>
          )}
          <Notice>
            This checks arithmetic only. It does not approve a method, determine
            pass/fail or issue a test report.
          </Notice>
        </Card>
        <Card className={tw("source-card")}>
          <Badge tone="blue">Published reference</Badge>
          <h2>A traceable starting point</h2>
          <p>
            Three historical specimen results from a concrete-cube report hosted
            by BBMP.
          </p>
          <dl className={tw("source-details")}>
            <div>
              <dt>Report</dt>
              <dd>CQC/LW No. 26/2018-19</dd>
            </div>
            <div>
              <dt>Report date</dt>
              <dd>01 October 2018</dd>
            </div>
            <div>
              <dt>Loaded area</dt>
              <dd>22,500 mm²</dd>
            </div>
            <div>
              <dt>Fixture version</dt>
              <dd>reference-1</dd>
            </div>
          </dl>
          <a
            className={tw("source-link")}
            href={referenceSource.url}
            target="_blank"
            rel="noreferrer"
          >
            Open public source <ExternalLink size={15} />
          </a>
          <small>
            Values were retrieved from the indexed report. Direct PDF retrieval
            timed out; this does not verify the current test standard.
          </small>
          <div className={tw("source-divider")} />
          <h3>Your laboratory methods stay separate</h3>
          <p>
            When you provide the original sheets, their formulas, units and
            rounding will be mapped and compared independently.
          </p>
        </Card>
      </div>
      <Card className={tw("reference-checks")}>
        <div className={tw("section-heading")}>
          <div>
            <h2>Published sample checks</h2>
            <p>
              Source output compared with calculated output, to two decimals.
            </p>
          </div>
          {data && (
            <Badge tone={data.checks.every((c) => c.matches) ? "green" : "red"}>
              {data.checks.filter((c) => c.matches).length} /{" "}
              {data.checks.length} matched
            </Badge>
          )}
        </div>
        {error ? (
          <Notice tone="red">{error}</Notice>
        ) : loading ? (
          <Loading />
        ) : (
          data && (
            <div className={tw("table-scroll")}>
              <table>
                <thead>
                  <tr>
                    <th>SPECIMEN</th>
                    <th>FAILURE LOAD</th>
                    <th>SOURCE VALUE</th>
                    <th>CALCULATED</th>
                    <th>COMPARISON</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.checks.map((row) => (
                    <tr key={row.specimen}>
                      <td>Cube {row.specimen}</td>
                      <td>{row.loadKn} kN</td>
                      <td>{row.expected} N/mm²</td>
                      <td>
                        <b>{row.displayed} N/mm²</b>
                      </td>
                      <td>
                        <span className={tw("matched")}>
                          <CheckCircle2 size={14} />
                          {row.matches ? "Matched" : "Mismatch"}
                        </span>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setLoad(row.loadKn);
                            setArea(referenceSource.areaMm2);
                            setResult(null);
                          }}
                        >
                          Use values <ArrowRight size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>
    </>
  );
}
