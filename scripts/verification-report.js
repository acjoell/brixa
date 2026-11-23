const domains = {
  modality: ["frontend", "backend", "fullstack"],
  language: ["ts", "js"],
  database: ["none", "postgres", "sqlite"],
  docker: [false, true],
  apiDocs: [false, true],
  i18n: [false, true],
};

function normalize(variant) {
  return Object.fromEntries(
    Object.entries(domains).map(([key, values]) => [key, variant[key] ?? values[0]]),
  );
}

export function variantKey(variant) {
  return JSON.stringify(normalize(variant));
}

function pairs(variants) {
  const result = new Set();
  for (const variant of variants) {
    const entries = Object.entries(normalize(variant));
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        result.add(JSON.stringify([entries[i], entries[j]]));
      }
    }
  }
  return result;
}

export function validCombinations() {
  let variants = [{}];
  for (const [key, values] of Object.entries(domains)) {
    variants = variants.flatMap((v) => values.map((value) => ({ ...v, [key]: value })));
  }
  return variants.filter(
    (v) =>
      !(v.modality === "frontend" && (v.database !== "none" || v.docker || v.apiDocs)) &&
      !(v.modality === "backend" && v.i18n),
  );
}

// Outcomes refer only to this invocation, including filtered/partitioned runs.
export function verificationReport(declared, selected, outcomes, mode = "all") {
  const selectedKeys = new Set(selected.map(variantKey));
  const variants = declared.map((variant) => {
    const outcome = outcomes.find((r) => variantKey(r.variant) === variantKey(variant));
    return {
      variant: normalize(variant),
      selected: selectedKeys.has(variantKey(variant)),
      status: outcome?.status ?? "NOT_RUN",
    };
  });
  const groups = new Map();
  for (const row of variants) {
    const { language, ...configuration } = row.variant;
    const key = JSON.stringify(configuration);
    if (!groups.has(key)) groups.set(key, { configuration, ts: "UNDECLARED", js: "UNDECLARED" });
    groups.get(key)[language] = row.status;
  }
  const languagePairs = [...groups.values()].map((pair) => ({
    ...pair,
    complete: pair.ts === "PASSED" && pair.js === "PASSED",
    different: pair.ts !== pair.js,
    failed: pair.ts === "FAILED" || pair.js === "FAILED",
  }));
  const valid = validCombinations();
  const validPairs = pairs(valid);
  const declaredPairs = pairs(declared);
  const executed = outcomes.map((r) => r.variant);
  const executedPairs = pairs(executed);
  const passedPairs = pairs(outcomes.filter((r) => r.status === "PASSED").map((r) => r.variant));
  return {
    mode,
    success: variants.filter((v) => v.selected).every((v) => v.status === "PASSED"),
    variants,
    languagePairs,
    coverage: {
      validCombinations: valid.length,
      declaredVariants: declared.length,
      executedVariants: executed.length,
      validPairs: validPairs.size,
      declaredPairs: declaredPairs.size,
      executedPairs: executedPairs.size,
      passedPairs: passedPairs.size,
      missingDeclaredPairs: [...validPairs].filter((p) => !declaredPairs.has(p)).map(JSON.parse),
    },
  };
}

export function printVerificationReport(report) {
  console.log("\nInforme de variantes y pares JS/TS");
  console.table(
    report.languagePairs.map(({ configuration, ...result }) => ({
      configuration: JSON.stringify(configuration),
      ...result,
    })),
  );
  console.log(JSON.stringify(report, null, 2));
}

export async function runReportedVerification(
  declared,
  selected,
  verify,
  mode = "all",
  report = (outcomes) =>
    printVerificationReport(verificationReport(declared, selected, outcomes, mode)),
) {
  const outcomes = [];
  try {
    for (const [index, variant] of selected.entries()) {
      try {
        const status = (await verify(variant, index)) ?? "PASSED";
        outcomes.push({ variant, status });
      } catch (error) {
        outcomes.push({ variant, status: "FAILED" });
        throw error;
      }
      if (outcomes.at(-1).status !== "PASSED") {
        throw new Error(`Verificación obligatoria incompleta: ${variantKey(variant)}`);
      }
    }
  } finally {
    report(outcomes);
  }
}
