export const mobileSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48
} as const;

export const mobileRadius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999
} as const;

export const mobileLayout = {
  shellPaddingHorizontal: mobileSpacing.sm,
  shellPaddingTop: mobileSpacing.xs,
  shellPaddingBottom: mobileSpacing.xs,
  screenPaddingHorizontal: mobileSpacing.sm,
  screenPaddingTop: mobileSpacing.xs,
  screenPaddingBottom: mobileSpacing.sm,
  sectionGap: mobileSpacing.sm,
  compactGap: mobileSpacing.xs,
  microGap: mobileSpacing.xxs,
  cardPadding: mobileSpacing.sm,
  gridGap: mobileSpacing.xs,
  tileWidth: "49%" as const
} as const;

export const mobileShadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  floating: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  nav: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7
  }
} as const;
