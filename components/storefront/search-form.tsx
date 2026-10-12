"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analytics } from "@/lib/analytics";
import { pendo } from "@/lib/pendo/client";

interface SubmittedSearch {
  query: string;
  previousQuery: string | null;
  sourcePath: string;
}

/** A search from the header that is waiting for the catalog to say how many products matched. */
let submittedSearch: SubmittedSearch | null = null;

/**
 * The catalog calls this whenever its results change. The first results for a submitted search
 * complete that search, so searches that match nothing are recorded with zero results.
 */
export function reportSearchResults(query: string, resultsCount: number): void {
  const search = submittedSearch;
  if (!search || search.query.toLowerCase() !== query) return;
  submittedSearch = null;
  pendo.track("products_searched", { ...search, resultsCount });
}

export function SearchForm() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  return (
    <form
      role="search"
      className="flex w-full max-w-sm items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
          analytics.track("Products Searched", { query: trimmed });
          // Submitting the search that is already on screen changes nothing, so it is not counted.
          const unchanged =
            pathname === "/products" &&
            params.toString() === new URLSearchParams({ q: trimmed }).toString();
          if (!unchanged) {
            submittedSearch = {
              query: trimmed,
              previousQuery: params.get("q"),
              sourcePath: pathname,
            };
          }
        }
        router.push(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : "/products");
      }}
    >
      <Input
        type="search"
        name="q"
        placeholder="Search plants, pots, tools"
        aria-label="Search products"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        data-testid="nav-search-input"
      />
      <Button
        type="submit"
        variant="secondary"
        size="icon"
        aria-label="Search"
        data-testid="nav-search-submit"
      >
        <Search />
      </Button>
    </form>
  );
}
