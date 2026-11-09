// Static tooth image mapping for the FDI odontogram.
// Each tooth type has a realistic 3D-rendered image. Lower teeth that share
// morphology with upper teeth are rendered by flipping the upper image 180°.

const IMAGES = {
  incisor_up:        '/assets/teeth/incisor-up.png',
  canine_up:         '/assets/teeth/canine-up.png',
  premolar_up:       '/assets/teeth/premolar-up.png',
  molar_up:          '/assets/teeth/molar-up.png',
  premolar_down:     '/assets/teeth/premolar-down.png',
  molar_down:        '/assets/teeth/molar-down.png',
  primary_incisor_up:'/assets/teeth/primary-incisor-up.png',
  primary_molar_up:  '/assets/teeth/primary-molar-up.png',
  primary_molar_down:'/assets/teeth/primary-molar-down.png',
};

// FDI quadrant layout
export const PERMANENT_ROWS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft:  [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft:  [31, 32, 33, 34, 35, 36, 37, 38],
};

export const PRIMARY_ROWS = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft:  [61, 62, 63, 64, 65],
  lowerRight: [85, 84, 83, 82, 81],
  lowerLeft:  [71, 72, 73, 74, 75],
};

// Determine which image + transform to use for a given FDI number
export function getToothImage(num) {
  const last = num % 10;
  const isPrimary = num >= 51 && num <= 85;
  const isUpper = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);

  let key;
  let flip = false;

  if (isPrimary) {
    if (last >= 4 && last <= 5) {
      key = isUpper ? 'primary_molar_up' : 'primary_molar_down';
    } else {
      // Primary incisors and canines share the incisor image
      key = 'primary_incisor_up';
      if (!isUpper) flip = true;
    }
  } else {
    if (last >= 6 && last <= 8) {
      key = isUpper ? 'molar_up' : 'molar_down';
    } else if (last === 4 || last === 5) {
      key = isUpper ? 'premolar_up' : 'premolar_down';
    } else if (last === 3) {
      key = 'canine_up';
      if (!isUpper) flip = true;
    } else {
      key = 'incisor_up';
      if (!isUpper) flip = true;
    }
  }

  return { url: IMAGES[key], flip };
}

// Derive a tooth's clinical status from its treatment records
export function getToothStatus(treatments) {
  if (!treatments || treatments.length === 0) return 'none';
  const statuses = treatments.map(t => t.status);
  if (statuses.some(s => s === 'in_progress')) return 'in_progress';
  if (statuses.some(s => s === 'planned')) return 'planned';
  if (statuses.every(s => s === 'completed')) return 'completed';
  if (statuses.every(s => s === 'cancelled')) return 'none';
  return 'planned';
}
