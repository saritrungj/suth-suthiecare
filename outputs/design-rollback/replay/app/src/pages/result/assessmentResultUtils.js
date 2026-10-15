const isNumericScore = (result) => Number.isFinite(Number(result?.score));

const roundScore = (score) => Math.round(score * 100) / 100;

// The submitted score results remain the source of truth. This only adds a
// display-only total when the form has more than one scored section.
export const buildAssessmentResultSections = (results = []) => {
  const parts = results.filter(isNumericScore);

  if (parts.length < 2) {
    return parts.map((part) => ({ ...part, displayKind: "section" }));
  }

  const total = roundScore(
    parts.reduce((sum, part) => sum + Number(part.score), 0),
  );

  return [
    {
      id: "total-score",
      displayKind: "total",
      score: total,
      partCount: parts.length,
    },
    ...parts.map((part) => ({ ...part, displayKind: "section" })),
  ];
};
