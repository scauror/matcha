import { FormEvent } from "react";

export type BrowseQuery = {
  minAge: string;
  maxAge: string;
  minFame: string;
  maxFame: string;
  maxDistance: string;
  tags: string;
  sort: string;
  order: string;
};

export const emptyQuery: BrowseQuery = {
  minAge: "",
  maxAge: "",
  minFame: "",
  maxFame: "",
  maxDistance: "",
  tags: "",
  sort: "smart",
  order: "desc",
};

export function toSearchParams(q: BrowseQuery): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v) p.set(k, v);
  }
  return p.toString();
}

type Props = {
  value: BrowseQuery;
  onChange: (next: BrowseQuery) => void;
  onSubmit: () => void;
  smartDefault?: boolean;
};

export function BrowseFilters({ value, onChange, onSubmit, smartDefault = true }: Props) {
  function set<K extends keyof BrowseQuery>(key: K, val: string) {
    onChange({ ...value, [key]: val });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form className="panel filters" onSubmit={submit}>
      <div className="filters-grid">
        <label>
          Âge min
          <input
            type="number"
            min={18}
            max={99}
            value={value.minAge}
            onChange={(e) => set("minAge", e.target.value)}
          />
        </label>
        <label>
          Âge max
          <input
            type="number"
            min={18}
            max={99}
            value={value.maxAge}
            onChange={(e) => set("maxAge", e.target.value)}
          />
        </label>
        <label>
          Fame min
          <input
            type="number"
            min={0}
            max={1000}
            value={value.minFame}
            onChange={(e) => set("minFame", e.target.value)}
          />
        </label>
        <label>
          Fame max
          <input
            type="number"
            min={0}
            max={1000}
            value={value.maxFame}
            onChange={(e) => set("maxFame", e.target.value)}
          />
        </label>
        <label>
          Distance max (km)
          <input
            type="number"
            min={1}
            value={value.maxDistance}
            onChange={(e) => set("maxDistance", e.target.value)}
          />
        </label>
        <label>
          Tags (virgules)
          <input
            value={value.tags}
            placeholder="geek, vegan"
            onChange={(e) => set("tags", e.target.value)}
          />
        </label>
        <label>
          Trier par
          <select value={value.sort} onChange={(e) => set("sort", e.target.value)}>
            {smartDefault ? <option value="smart">Pertinence</option> : null}
            <option value="age">Âge</option>
            <option value="distance">Localisation</option>
            <option value="fame">Popularité</option>
            <option value="tags">Tags communs</option>
          </select>
        </label>
        <label>
          Ordre
          <select
            value={value.order}
            onChange={(e) => set("order", e.target.value)}
            disabled={value.sort === "smart"}
          >
            <option value="asc">Croissant</option>
            <option value="desc">Décroissant</option>
          </select>
        </label>
      </div>
      <button className="btn" type="submit">
        Appliquer
      </button>
    </form>
  );
}
