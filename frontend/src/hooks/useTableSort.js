import { useState, useMemo } from "react";

/**
 * Provides client-side sorting and filtering for tabular data.
 */
export function useTableSort(columns, rows) {
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });
  const [filterText, setFilterText] = useState("");

  const handleSort = (colIndex) => {
    setSortConfig((prev) => ({
      key: colIndex,
      dir: prev.key === colIndex && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const processed = useMemo(() => {
    let result = [...rows];

    // Filter: check if any cell in the row contains the filter text
    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      result = result.filter((row) =>
        row.some((cell) =>
          cell !== null && String(cell).toLowerCase().includes(lower)
        )
      );
    }

    // Sort
    if (sortConfig.key !== null) {
      result.sort((a, b) => {
        const av = a[sortConfig.key];
        const bv = b[sortConfig.key];
        if (av === null) return 1;
        if (bv === null) return -1;

        // Try numeric comparison
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) {
          return sortConfig.dir === "asc" ? an - bn : bn - an;
        }

        // String comparison
        const cmp = String(av).localeCompare(String(bv));
        return sortConfig.dir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, sortConfig, filterText]);

  return { sortConfig, handleSort, filterText, setFilterText, processedRows: processed };
}