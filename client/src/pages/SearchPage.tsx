import { BrowseList } from "../components/BrowseList";

export function SearchPage() {
  return (
    <BrowseList
      endpoint="/api/browse/search"
      title="Recherche avancée"
      lead="Filtre par âge, popularité, distance et tags. Les résultats restent compatibles avec tes préférences."
      smartDefault
    />
  );
}
