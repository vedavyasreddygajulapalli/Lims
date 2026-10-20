import { useEffect, useState } from "react";
import { request } from "./client";
export function useQuery<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setData(null);
    request<T>(path)
      .then((v) => {
        if (current) setData(v);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  return { data, error, loading, reload: () => setRevision((v) => v + 1) };
}
