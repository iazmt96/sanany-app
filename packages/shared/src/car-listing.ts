export const CAR_MAKE_IDS = [
  "toyota",
  "nissan",
  "hyundai",
  "kia",
  "ford",
  "chevrolet",
  "honda",
  "mazda",
  "mitsubishi",
  "lexus",
  "bmw",
  "mercedes",
  "audi",
  "volkswagen",
  "porsche",
  "jeep",
  "dodge",
  "gmc",
  "cadillac",
  "landRover",
  "volvo",
  "tesla",
  "peugeot",
  "renault",
  "suzuki",
  "isuzu",
  "infiniti",
  "lincoln",
  "mini",
  "subaru",
  "geely",
  "haval",
  "mg",
  "chery",
  "byd",
  "gac",
  "skoda",
  "seat",
  "fiat",
  "alfaRomeo"
] as const;

export type CarMakeId = (typeof CAR_MAKE_IDS)[number];

export const POPULAR_SAUDI_CAR_MAKE_IDS: readonly CarMakeId[] = [
  "toyota",
  "hyundai",
  "nissan",
  "kia",
  "ford",
  "chevrolet",
  "mercedes",
  "bmw",
  "lexus",
  "gmc",
  "mazda",
  "honda",
  "isuzu",
  "geely",
  "haval",
  "mg"
];

export const CAR_MODELS_BY_MAKE: Record<CarMakeId, readonly string[]> = {
  toyota: ["Camry", "Corolla", "Yaris", "Land Cruiser"],
  nissan: ["Patrol", "Altima", "Sunny", "X-Trail"],
  hyundai: ["Elantra", "Sonata", "Accent", "Tucson"],
  kia: ["Sportage", "Cerato", "K5", "Picanto"],
  ford: ["Taurus", "F-150", "Explorer", "Edge"],
  chevrolet: ["Tahoe", "Suburban", "Malibu", "Captiva"],
  honda: ["Civic", "Accord", "CR-V"],
  mazda: ["Mazda 3", "Mazda 6", "CX-5"],
  mitsubishi: ["Lancer", "Attrage", "Pajero"],
  lexus: ["ES", "RX", "LX"],
  bmw: ["3 Series", "5 Series", "X5"],
  mercedes: ["C-Class", "E-Class", "GLE"],
  audi: ["A4", "A6", "Q5"],
  volkswagen: ["Passat", "Tiguan", "Golf"],
  porsche: ["Cayenne", "Macan", "Panamera"],
  jeep: ["Wrangler", "Grand Cherokee", "Compass"],
  dodge: ["Charger", "Challenger", "Durango"],
  gmc: ["Yukon", "Sierra", "Terrain"],
  cadillac: ["Escalade", "XT5", "CT5"],
  landRover: ["Defender", "Range Rover", "Discovery"],
  volvo: ["S90", "XC60", "XC90"],
  tesla: ["Model 3", "Model Y", "Model S"],
  peugeot: ["3008", "508", "208"],
  renault: ["Duster", "Koleos", "Megane"],
  suzuki: ["Swift", "Vitara", "Jimny"],
  isuzu: ["D-Max", "MU-X", "N-Series"],
  infiniti: ["Q50", "QX50", "QX80"],
  lincoln: ["Navigator", "Aviator", "Corsair"],
  mini: ["Cooper", "Countryman", "Clubman"],
  subaru: ["Impreza", "Forester", "Outback"],
  geely: ["Coolray", "Emgrand", "Azkarra"],
  haval: ["H6", "Jolion", "H9"],
  mg: ["MG 5", "MG ZS", "MG 6"],
  chery: ["Tiggo 7", "Tiggo 8", "Arrizo 6"],
  byd: ["Song Plus", "Han", "Dolphin"],
  gac: ["GS8", "Emkoo", "Emzoom"],
  skoda: ["Octavia", "Kodiaq", "Superb"],
  seat: ["Leon", "Ateca", "Ibiza"],
  fiat: ["500", "Tipo", "Panda"],
  alfaRomeo: ["Giulia", "Stelvio", "Tonale"]
};

export const OTHER_CAR_MODEL_ID = "other-model";
export const CAR_MIN_YEAR = 1950;
export const CAR_MAX_YEAR_OFFSET = 1;
export const CAR_MAX_MILEAGE = 2_000_000;
export const CAR_MIN_PRICE = 500;
export const CAR_MAX_PRICE = 20_000_000;

export type CarListingValidationErrorKey =
  | "carBrandRequired"
  | "carModelOptionRequired"
  | "carModelOtherRequired"
  | "carYearRequired"
  | "carYearInvalidRange"
  | "carMileageInvalid"
  | "carMileageTooHigh"
  | "priceInvalid"
  | "priceOutOfRange";

export type CarListingValidationInput = {
  isCarSaleCategory: boolean;
  shouldRequirePrice: boolean;
  carBrand: CarMakeId | null;
  carModelOption: string | null;
  carModelOther: string;
  carYear: string | null;
  carMileage: string;
  parsedPrice: number;
};

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");
}

function makeModelId(makeId: CarMakeId, modelName: string): string {
  return `${makeId}:${normalizeSearchValue(modelName)}`;
}

export type CarModelOption = {
  id: string;
  label: string;
  searchValues?: string[];
};

export function buildCarModelOptions(makeId: CarMakeId): CarModelOption[] {
  return CAR_MODELS_BY_MAKE[makeId].map((modelName) => ({
    id: makeModelId(makeId, modelName),
    label: modelName
  }));
}

export function buildCarYearsRange(currentYear = new Date().getFullYear()): string[] {
  const latestYear = currentYear + CAR_MAX_YEAR_OFFSET;
  return Array.from({ length: latestYear - CAR_MIN_YEAR + 1 }, (_, index) => String(latestYear - index));
}

export function searchCarMakes(input: {
  query: string;
  recentMakeIds: readonly CarMakeId[];
  resolveMakeLabel(makeId: CarMakeId): string;
}): CarMakeId[] {
  const normalizedQuery = normalizeSearchValue(input.query.trim());
  const recentScoreById = new Map(input.recentMakeIds.map((id, index) => [id, 30 - index]));
  const popularSet = new Set<CarMakeId>(POPULAR_SAUDI_CAR_MAKE_IDS);

  const ranked = CAR_MAKE_IDS.map((makeId) => {
    const normalizedLabel = normalizeSearchValue(input.resolveMakeLabel(makeId));
    const normalizedId = normalizeSearchValue(makeId);
    const exactMatch = normalizedQuery.length > 0 && (normalizedLabel === normalizedQuery || normalizedId === normalizedQuery);
    const startsWithMatch =
      normalizedQuery.length > 0 && !exactMatch && (normalizedLabel.startsWith(normalizedQuery) || normalizedId.startsWith(normalizedQuery));
    const includesMatch =
      normalizedQuery.length > 0 && !exactMatch && !startsWithMatch && (normalizedLabel.includes(normalizedQuery) || normalizedId.includes(normalizedQuery));
    const matches = normalizedQuery.length === 0 || exactMatch || startsWithMatch || includesMatch;
    if (!matches) {
      return null;
    }

    let score = 0;
    if (exactMatch) {
      score += 120;
    } else if (startsWithMatch) {
      score += 80;
    } else if (includesMatch) {
      score += 40;
    }
    if (popularSet.has(makeId)) {
      score += 20;
    }
    score += recentScoreById.get(makeId) ?? 0;

    return { makeId, score, label: input.resolveMakeLabel(makeId) };
  }).filter((item): item is { makeId: CarMakeId; score: number; label: string } => item !== null);

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.label.localeCompare(b.label);
  });

  return ranked.map((item) => item.makeId);
}

export function searchCarModels(modelOptions: CarModelOption[], query: string): CarModelOption[] {
  const normalizedQuery = normalizeSearchValue(query.trim());
  if (!normalizedQuery) {
    return modelOptions;
  }

  return modelOptions
    .map((option) => {
      const normalizedSearchValues = [option.label, ...(option.searchValues ?? [])].map(normalizeSearchValue);
      const normalizedId = normalizeSearchValue(option.id);
      const exactMatch = normalizedSearchValues.some((value) => value === normalizedQuery) || normalizedId === normalizedQuery;
      const startsWithMatch =
        !exactMatch && (normalizedSearchValues.some((value) => value.startsWith(normalizedQuery)) || normalizedId.startsWith(normalizedQuery));
      const includesMatch =
        !exactMatch &&
        !startsWithMatch &&
        (normalizedSearchValues.some((value) => value.includes(normalizedQuery)) || normalizedId.includes(normalizedQuery));
      if (!exactMatch && !startsWithMatch && !includesMatch) {
        return null;
      }
      const score = exactMatch ? 120 : startsWithMatch ? 80 : 40;
      return { ...option, score };
    })
    .filter((item): item is { id: string; label: string; score: number } => item !== null)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.label.localeCompare(b.label);
    })
    .map(({ id, label }) => ({ id, label }));
}

export function validateCarListingDraft(input: CarListingValidationInput): CarListingValidationErrorKey[] {
  const errors: CarListingValidationErrorKey[] = [];

  if (input.shouldRequirePrice) {
    if (!Number.isFinite(input.parsedPrice) || input.parsedPrice <= 0) {
      errors.push("priceInvalid");
    } else if (input.parsedPrice < CAR_MIN_PRICE || input.parsedPrice > CAR_MAX_PRICE) {
      errors.push("priceOutOfRange");
    }
  }

  if (!input.isCarSaleCategory) {
    return errors;
  }

  if (!input.carBrand) {
    errors.push("carBrandRequired");
    return errors;
  }

  if (!input.carModelOption) {
    errors.push("carModelOptionRequired");
  } else if (input.carModelOption === OTHER_CAR_MODEL_ID && input.carModelOther.trim().length === 0) {
    errors.push("carModelOtherRequired");
  } else if (input.carModelOption !== OTHER_CAR_MODEL_ID) {
    const knownModelIds = new Set(buildCarModelOptions(input.carBrand).map((model) => model.id));
    if (!knownModelIds.has(input.carModelOption)) {
      errors.push("carModelOptionRequired");
    }
  }

  if (!input.carYear) {
    errors.push("carYearRequired");
  } else {
    const parsedYear = Number(input.carYear);
    const maxYear = new Date().getFullYear() + CAR_MAX_YEAR_OFFSET;
    if (!Number.isInteger(parsedYear) || parsedYear < CAR_MIN_YEAR || parsedYear > maxYear) {
      errors.push("carYearInvalidRange");
    }
  }

  if (input.carMileage.trim().length > 0) {
    const parsedMileage = Number(input.carMileage);
    if (!Number.isFinite(parsedMileage) || parsedMileage < 0) {
      errors.push("carMileageInvalid");
    } else if (parsedMileage > CAR_MAX_MILEAGE) {
      errors.push("carMileageTooHigh");
    }
  }

  return errors;
}
