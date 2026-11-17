import { describe, it, expect } from "vitest";
import {
  PORTABLE_PARTITIONS,
  getPortableVariants,
  validatePortablePartitions,
  getVariantLabel,
} from "./verify-generated.js";

describe("Partición portable del arnés de verificación", () => {
  it("las particiones configuradas superan la validación automatizada", () => {
    const portableVariants = getPortableVariants();
    expect(() => validatePortablePartitions(portableVariants)).not.toThrow();
  });

  it("existen exactamente 15 variantes portables en total", () => {
    const portableVariants = getPortableVariants();
    expect(portableVariants.length).toBe(15);
  });

  it("el Grupo A contiene exactamente 8 variantes", () => {
    expect(PORTABLE_PARTITIONS.A.length).toBe(8);
  });

  it("el Grupo B contiene exactamente 7 variantes", () => {
    expect(PORTABLE_PARTITIONS.B.length).toBe(7);
  });

  it("la unión de ambos grupos coincide exactamente con el conjunto de variantes portables", () => {
    const portableLabels = new Set(getPortableVariants().map(getVariantLabel));
    const union = new Set([...PORTABLE_PARTITIONS.A, ...PORTABLE_PARTITIONS.B]);

    expect(union.size).toBe(15);
    expect(union).toEqual(portableLabels);
  });

  it("la intersección entre el Grupo A y el Grupo B es estrictamente vacía", () => {
    const setB = new Set(PORTABLE_PARTITIONS.B);
    const duplicates = PORTABLE_PARTITIONS.A.filter((v) => setB.has(v));
    expect(duplicates).toEqual([]);
  });

  it("contiene los identificadores exactos según el registro vigente", () => {
    expect(PORTABLE_PARTITIONS.A).toEqual([
      "frontend+ts",
      "frontend+js",
      "backend+js",
      "backend+ts+sqlite",
      "fullstack+js+sqlite",
      "backend+ts+docs",
      "backend+js+docs",
      "fullstack+js+sqlite+docs",
    ]);

    expect(PORTABLE_PARTITIONS.B).toEqual([
      "backend+ts",
      "fullstack+ts",
      "fullstack+js",
      "backend+js+sqlite",
      "fullstack+ts+sqlite",
      "frontend+ts+i18n",
      "fullstack+js+sqlite+i18n",
    ]);
  });

  describe("validatePortablePartitions — controles negativos y robustez", () => {
    it("falla si una variante en las particiones es desconocida o no portable", () => {
      const portable = getPortableVariants();
      const invalidPartitions = {
        A: [...PORTABLE_PARTITIONS.A, "variante+inexistente"],
        B: [...PORTABLE_PARTITIONS.B],
      };
      expect(() => validatePortablePartitions(portable, invalidPartitions)).toThrow(
        /desconocida o no portable/i,
      );
    });

    it("falla si una variante no portable (p. ej. docker o postgres) está en una partición", () => {
      const portable = getPortableVariants();
      const invalidPartitions = {
        A: [...PORTABLE_PARTITIONS.A, "backend+ts+postgres"],
        B: [...PORTABLE_PARTITIONS.B],
      };
      expect(() => validatePortablePartitions(portable, invalidPartitions)).toThrow(
        /desconocida o no portable/i,
      );
    });

    it("falla si hay variantes duplicadas entre particiones (intersección no vacía)", () => {
      const portable = getPortableVariants();
      const overlappingPartitions = {
        A: [...PORTABLE_PARTITIONS.A],
        B: [...PORTABLE_PARTITIONS.B, PORTABLE_PARTITIONS.A[0]],
      };
      expect(() => validatePortablePartitions(portable, overlappingPartitions)).toThrow(
        /duplicada/i,
      );
    });

    it("falla si alguna variante portable es omitida silenciosamente", () => {
      const portable = getPortableVariants();
      const missingPartitions = {
        A: PORTABLE_PARTITIONS.A.slice(1), // omitimos la primera
        B: [...PORTABLE_PARTITIONS.B],
      };
      expect(() => validatePortablePartitions(portable, missingPartitions)).toThrow(
        /omitidas en las particiones/i,
      );
    });

    it("falla si se agregan nuevas variantes portables al arnés y no se incorporan a las particiones", () => {
      const portableWithExtra = [
        ...getPortableVariants(),
        { modality: "backend", language: "go", database: "none" },
      ];
      expect(() => validatePortablePartitions(portableWithExtra)).toThrow(
        /omitidas en las particiones/i,
      );
    });

    it("falla si la partición está vacía o malformada", () => {
      const portable = getPortableVariants();
      expect(() => validatePortablePartitions(portable, {})).toThrow(/No hay particiones/i);
      expect(() => validatePortablePartitions(portable, { A: [], B: [] })).toThrow(/vacía/i);
      expect(() => validatePortablePartitions(portable, null)).toThrow(/formato inválido/i);
    });
  });
});
