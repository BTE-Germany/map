export const FEDERAL_STATE_NAMES: Record<string, string> = {
    "BW": "Baden-Württemberg",
    "BY": "Bayern",
    "BE": "Berlin",
    "BB": "Brandenburg",
    "HB": "Bremen",
    "HH": "Hamburg",
    "HE": "Hessen",
    "MV": "Mecklenburg-Vorpommern",
    "NI": "Niedersachsen",
    "NW": "Nordrhein-Westfalen",
    "RP": "Rheinland-Pfalz",
    "SL": "Saarland",
    "SN": "Sachsen",
    "ST": "Sachsen-Anhalt",
    "SH": "Schleswig-Holstein",
    "TH": "Thüringen",
};

/**
 * Gebietsfläche der Länder in m² (Statistisches Bundesamt, Stand 31.12.2023).
 * Summiert ergibt das die 357.588 km² Gesamtfläche Deutschlands und dient als
 * Nenner für den Fortschrittsbalken je Bundesland.
 */
export const FEDERAL_STATE_AREAS_SQM: Record<string, number> = {
    "BW": 35_747_850_000,
    "BY": 70_541_570_000,
    "BE": 891_120_000,
    "BB": 29_654_350_000,
    "HB": 419_620_000,
    "HH": 755_090_000,
    "HE": 21_115_640_000,
    "MV": 23_294_620_000,
    "NI": 47_709_820_000,
    "NW": 34_112_720_000,
    "RP": 19_857_970_000,
    "SL": 2_571_110_000,
    "SN": 18_449_930_000,
    "ST": 20_456_510_000,
    "SH": 15_804_300_000,
    "TH": 16_202_350_000,
};

export function stateCodeToName(stateCode: string) {
    return FEDERAL_STATE_NAMES[stateCode] || stateCode;
}

export function stateAreaSqm(stateCode: string): number | null {
    return FEDERAL_STATE_AREAS_SQM[stateCode] ?? null;
}
