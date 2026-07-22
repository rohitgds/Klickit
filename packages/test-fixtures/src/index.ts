export type SyntheticDrKlickRow = {
  sourceRowNumber: number;
  sourcePatientKey: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  birthDate: string;
  addressLine1: string;
  categoryCode: string;
  clinicCode: string;
};

export function generateSyntheticDrKlickRows(count: number, clinicCode = "DEV"): SyntheticDrKlickRow[] {
  const rows: SyntheticDrKlickRow[] = [];
  for (let index = 1; index <= count; index += 1) {
    rows.push({
      sourceRowNumber: index,
      sourcePatientKey: `DRK-SYN-${String(index).padStart(5, "0")}`,
      firstName: `Synthetic${index}`,
      lastName: "Patient",
      mobile: `9${String(100000000 + index).slice(-9)}`,
      email: `synthetic${index}@example.test`,
      birthDate: "1990-01-01",
      addressLine1: `${index} Training Street`,
      categoryCode: "GENERAL",
      clinicCode,
    });
  }
  return rows;
}
