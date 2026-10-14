/**
 * Score de popularité (exemple cohérent, à affiner) :
 * +1 vue · +2 like reçu · −5 report · −1 unlike
 * Clampé entre 0 et 1000.
 */
export function computeFameDelta(event: "view" | "like" | "unlike" | "report"): number {
  switch (event) {
    case "view":
      return 1;
    case "like":
      return 2;
    case "unlike":
      return -1;
    case "report":
      return -5;
  }
}
