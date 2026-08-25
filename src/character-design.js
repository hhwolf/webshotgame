export const CHARACTER_PROFILES = {
  rifleman: {
    shape: "balanced", chestRadius: 0.38, chestLength: 0.22, chestWidth: 1.18, chestDepth: 0.72,
    shoulderX: 0.52, armRadius: 0.14, armLength: 0.58, legRadius: 0.16, legLength: 0.66, legX: 0.23,
    headRadius: 0.38, headWidth: 1, bootWidth: 0.3, weaponWidth: 0.62, weaponLength: 0.72, gait: 0.52
  },
  rusher: {
    shape: "runner", chestRadius: 0.32, chestLength: 0.18, chestWidth: 1.02, chestDepth: 0.7,
    shoulderX: 0.43, armRadius: 0.12, armLength: 0.55, legRadius: 0.14, legLength: 0.8, legX: 0.2,
    headRadius: 0.35, headWidth: 0.94, bootWidth: 0.27, weaponWidth: 0.5, weaponLength: 0.52, gait: 0.72
  },
  heavy: {
    shape: "wedge", chestRadius: 0.47, chestLength: 0.2, chestWidth: 1.28, chestDepth: 0.78,
    shoulderX: 0.67, armRadius: 0.2, armLength: 0.62, legRadius: 0.21, legLength: 0.58, legX: 0.3,
    headRadius: 0.4, headWidth: 1.08, bootWidth: 0.38, weaponWidth: 0.86, weaponLength: 0.82, gait: 0.38
  },
  scout: {
    shape: "arrow", chestRadius: 0.31, chestLength: 0.2, chestWidth: 0.96, chestDepth: 0.68,
    shoulderX: 0.42, armRadius: 0.115, armLength: 0.56, legRadius: 0.13, legLength: 0.82, legX: 0.19,
    headRadius: 0.34, headWidth: 0.92, bootWidth: 0.25, weaponWidth: 0.46, weaponLength: 0.94, gait: 0.62
  },
  boss: {
    shape: "champion", chestRadius: 0.5, chestLength: 0.24, chestWidth: 1.3, chestDepth: 0.8,
    shoulderX: 0.72, armRadius: 0.21, armLength: 0.64, legRadius: 0.22, legLength: 0.62, legX: 0.31,
    headRadius: 0.45, headWidth: 1.08, bootWidth: 0.4, weaponWidth: 0.92, weaponLength: 1.02, gait: 0.42
  }
};

export function characterProfile(role) {
  return CHARACTER_PROFILES[role] || CHARACTER_PROFILES.rifleman;
}

export function silhouetteSignature(profile) {
  return [profile.shape, profile.chestRadius, profile.chestWidth, profile.shoulderX, profile.legLength, profile.weaponLength].join(":");
}
