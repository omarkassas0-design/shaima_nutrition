// Dental anatomy data based on average adult permanent human dentition
// Dimensions in millimeters (mm) — sourced from standard dental anatomy references
// (Wheeler's Dental Anatomy, Ash & Nelson)

export const ARCH_TEETH = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};

export const ALL_FDI = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
];

export const TOOTH_NAMES = {
  11: "Maxillary Right Central Incisor",
  12: "Maxillary Right Lateral Incisor",
  13: "Maxillary Right Canine",
  14: "Maxillary Right First Premolar",
  15: "Maxillary Right Second Premolar",
  16: "Maxillary Right First Molar",
  17: "Maxillary Right Second Molar",
  18: "Maxillary Right Third Molar",
  21: "Maxillary Left Central Incisor",
  22: "Maxillary Left Lateral Incisor",
  23: "Maxillary Left Canine",
  24: "Maxillary Left First Premolar",
  25: "Maxillary Left Second Premolar",
  26: "Maxillary Left First Molar",
  27: "Maxillary Left Second Molar",
  28: "Maxillary Left Third Molar",
  31: "Mandibular Left Central Incisor",
  32: "Mandibular Left Lateral Incisor",
  33: "Mandibular Left Canine",
  34: "Mandibular Left First Premolar",
  35: "Mandibular Left Second Premolar",
  36: "Mandibular Left First Molar",
  37: "Mandibular Left Second Molar",
  38: "Mandibular Left Third Molar",
  41: "Mandibular Right Central Incisor",
  42: "Mandibular Right Lateral Incisor",
  43: "Mandibular Right Canine",
  44: "Mandibular Right First Premolar",
  45: "Mandibular Right Second Premolar",
  46: "Mandibular Right First Molar",
  47: "Mandibular Right Second Molar",
  48: "Mandibular Right Third Molar",
};

const TOOTH_TYPE_NAMES = {
  incisor_central: "Central Incisor",
  incisor_lateral: "Lateral Incisor",
  canine: "Canine",
  premolar_first: "First Premolar",
  premolar_second: "Second Premolar",
  molar_first: "First Molar",
  molar_second: "Second Molar",
  molar_third: "Third Molar",
};

function getBaseData(fdi) {
  const arch = fdi >= 11 && fdi <= 28 ? 'upper' : 'lower';
  const toothNum = fdi % 10;
  const isRight =
    (arch === 'upper' && fdi >= 11 && fdi <= 18) ||
    (arch === 'lower' && fdi >= 41 && fdi <= 48);

  const typeMap = {
    1: 'incisor_central', 2: 'incisor_lateral', 3: 'canine',
    4: 'premolar_first', 5: 'premolar_second',
    6: 'molar_first', 7: 'molar_second', 8: 'molar_third',
  };

  return { arch, isRight, type: typeMap[toothNum], toothNum };
}

// Dimension tables: [crownW, crownT, crownH, rootLen, rootW, rootCount]
// crownW = mesiodistal, crownT = buccolingual, crownH = incisocervical
const DIMENSIONS = {
  incisor_central: {
    upper: [8.6, 7.1, 11.6, 16.0, 4.0, 1],
    lower: [5.3, 5.7, 9.0, 13.5, 3.0, 1],
  },
  incisor_lateral: {
    upper: [6.6, 6.2, 10.0, 14.0, 3.5, 1],
    lower: [5.7, 6.1, 9.5, 13.5, 3.2, 1],
  },
  canine: {
    upper: [7.6, 8.0, 10.9, 17.0, 4.5, 1],
    lower: [6.8, 7.5, 11.0, 16.0, 4.0, 1],
  },
  premolar_first: {
    upper: [7.0, 9.2, 8.5, 14.0, 4.0, 2],
    lower: [6.8, 7.5, 8.5, 14.5, 4.0, 1],
  },
  premolar_second: {
    upper: [6.9, 8.2, 8.5, 14.0, 4.0, 1],
    lower: [6.9, 8.0, 8.0, 14.5, 4.0, 1],
  },
  molar_first: {
    upper: [10.4, 11.0, 7.5, 12.0, 5.0, 3],
    lower: [11.0, 10.5, 8.0, 14.0, 5.0, 2],
  },
  molar_second: {
    upper: [9.4, 10.0, 7.0, 11.0, 4.5, 3],
    lower: [10.0, 9.0, 7.5, 13.0, 4.5, 2],
  },
  molar_third: {
    upper: [8.8, 9.5, 7.0, 10.0, 4.0, 3],
    lower: [9.5, 8.5, 7.0, 11.0, 4.0, 2],
  },
};

function buildRoots(type, isUpper, rootLen, rootW, rootCount) {
  if (rootCount === 1) {
    return [{ length: rootLen, width: rootW, angle: 0, tilt: 0, curvature: 0.15, curvatureDir: 0 }];
  }
  if (rootCount === 2) {
    if (isUpper) {
      // Maxillary premolar: buccal + palatal
      return [
        { length: rootLen * 0.9, width: rootW * 0.7, angle: 0, tilt: 0.35, curvature: 0.1, curvatureDir: 0 },
        { length: rootLen, width: rootW * 0.7, angle: 0, tilt: -0.35, curvature: 0.1, curvatureDir: 0 },
      ];
    }
    // Mandibular molar: mesial + distal
    return [
      { length: rootLen, width: rootW * 0.8, angle: -0.28, tilt: 0, curvature: 0.15, curvatureDir: 1 },
      { length: rootLen * 0.85, width: rootW * 0.7, angle: 0.28, tilt: 0, curvature: 0.1, curvatureDir: 1 },
    ];
  }
  // Maxillary molar: mesiobuccal, distobuccal, palatal
  return [
    { length: rootLen * 0.9, width: rootW * 0.65, angle: -0.22, tilt: 0.28, curvature: 0.12, curvatureDir: 0 },
    { length: rootLen * 0.8, width: rootW * 0.6, angle: 0.22, tilt: 0.28, curvature: 0.1, curvatureDir: 0 },
    { length: rootLen, width: rootW * 0.7, angle: 0, tilt: -0.35, curvature: 0.1, curvatureDir: 0 },
  ];
}

function buildCusps(type, isUpper, w, t, h) {
  const cusps = [];
  if (type === 'canine') {
    cusps.push({ x: 0, z: t * 0.15, height: h * 0.4, radius: w * 0.35 });
  } else if (type === 'premolar_first' || type === 'premolar_second') {
    cusps.push({ x: 0, z: t * 0.25, height: h * 0.28, radius: w * 0.3 });
    cusps.push({ x: 0, z: -t * 0.25, height: h * 0.2, radius: w * 0.28 });
  } else if (type === 'molar_first' || type === 'molar_second' || type === 'molar_third') {
    if (isUpper) {
      cusps.push({ x: -w * 0.22, z: t * 0.22, height: h * 0.22, radius: w * 0.22 });
      cusps.push({ x: w * 0.22, z: t * 0.22, height: h * 0.2, radius: w * 0.22 });
      cusps.push({ x: -w * 0.22, z: -t * 0.22, height: h * 0.25, radius: w * 0.24 });
      cusps.push({ x: w * 0.22, z: -t * 0.22, height: h * 0.22, radius: w * 0.22 });
    } else {
      if (type === 'molar_first') {
        // 5 cusps: 3 buccal + 2 lingual
        cusps.push({ x: -w * 0.28, z: t * 0.22, height: h * 0.22, radius: w * 0.2 });
        cusps.push({ x: 0, z: t * 0.25, height: h * 0.2, radius: w * 0.18 });
        cusps.push({ x: w * 0.3, z: t * 0.2, height: h * 0.18, radius: w * 0.18 });
        cusps.push({ x: -w * 0.22, z: -t * 0.22, height: h * 0.25, radius: w * 0.22 });
        cusps.push({ x: w * 0.22, z: -t * 0.22, height: h * 0.22, radius: w * 0.2 });
      } else {
        cusps.push({ x: -w * 0.22, z: t * 0.22, height: h * 0.22, radius: w * 0.22 });
        cusps.push({ x: w * 0.22, z: t * 0.22, height: h * 0.2, radius: w * 0.22 });
        cusps.push({ x: -w * 0.22, z: -t * 0.22, height: h * 0.25, radius: w * 0.22 });
        cusps.push({ x: w * 0.22, z: -t * 0.22, height: h * 0.22, radius: w * 0.22 });
      }
    }
  }
  return cusps;
}

export function getToothAnatomy(fdi) {
  const base = getBaseData(fdi);
  const { arch, type } = base;
  const isUpper = arch === 'upper';
  const dims = DIMENSIONS[type][arch];
  const [crownW, crownT, crownH, rootLen, rootW, rootCount] = dims;

  return {
    fdi,
    ...base,
    isUpper,
    typeName: TOOTH_TYPE_NAMES[type],
    name: TOOTH_NAMES[fdi],
    crownW, crownT, crownH,
    rootLen, rootW, rootCount,
    roots: buildRoots(type, isUpper, rootLen, rootW, rootCount),
    cusps: buildCusps(type, isUpper, crownW, crownT, crownH),
  };
}