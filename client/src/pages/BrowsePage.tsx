import { BrowseList } from "../components/BrowseList";

export function BrowsePage() {
  return (
    <BrowseList
      endpoint="/api/browse/suggestions"
      title="Suggestions"
      lead="Profils compatibles, prioritaires près de toi, puis tags communs et popularité."
    />
  );
}
