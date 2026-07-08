export const en = {
  app: {
    title: "SANANY"
  },
  common: {
    loading: "Loading...",
    retry: "Try again",
    signOut: "Sign out",
    next: "Next",
    previous: "Previous",
    page: "Page {{current}} of {{total}}"
  },
  language: {
    ar: "Arabic",
    en: "English"
  },
  auth: {
    signInTitle: "Sign in",
    signUpTitle: "Create account",
    subtitle: "Your access gateway to SANANY marketplace",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Password",
    emailLabel: "Email",
    passwordLabel: "Password",
    signInAction: "Sign in",
    signUpAction: "Sign up",
    switchToSignUp: "Don't have an account? Sign up now",
    switchToSignIn: "Already have an account? Sign in",
    emailConfirmationSent: "Account created. Check your email to confirm your account, then sign in.",
    configError: "Authentication is unavailable due to missing configuration.",
    errors: {
      emailRequired: "Email is required.",
      passwordRequired: "Password is required.",
      invalidEmail: "Email format is invalid.",
      emailNotConfirmed: "Email is not confirmed yet. Check your inbox and try again.",
      invalidCredentials: "Invalid email or password.",
      userExists: "An account already exists for this email.",
      rateLimited: "Email rate limit exceeded. Please wait a few minutes before trying again.",
      passwordTooShort: "Password is too short. It must be at least 6 characters.",
      unknown: "An unexpected authentication error occurred."
    }
  },
  marketplace: {
    pageTitle: "Marketplace",
    pageSubtitle: "Browse recent offers from SANANY providers",
    pricePerDay: "SAR {{value}} / day",
    listCount: "{{count}} listings",
    postedAt: "Posted {{value}}",
    create: {
      title: "Post a new listing",
      open: "Post listing",
      close: "Close",
      listingTitleLabel: "Listing title",
      listingDescriptionLabel: "Listing description",
      listingPriceLabel: "Price",
      listingTitlePlaceholder: "Example: Home AC maintenance",
      listingDescriptionPlaceholder: "Write service or product details",
      listingPricePlaceholder: "Example: 180",
      submit: "Publish listing",
      success: "Listing published successfully.",
      errors: {
        authRequired: "You must be signed in to post a listing.",
        titleRequired: "Listing title is required.",
        priceInvalid: "Price must be a valid number greater than zero."
      }
    },
    sort: {
      label: "Sort",
      newest: "Newest",
      priceHigh: "Highest price",
      priceLow: "Lowest price"
    },
    searchPlaceholder: "Search listings",
    filters: {
      all: "All listings",
      available: "Available only",
      reserved: "Reserved only"
    },
    emptyState: "No listings matched your filters.",
    loadError: "Unable to load listings.",
    status: {
      available: "Available",
      reserved: "Reserved"
    },
    detail: {
      pageTitle: "Listing details",
      back: "Back to marketplace",
      description: "Listing description",
      noDescription: "This listing has no description.",
      notFound: "Listing not found."
    },
    signOutHint: "Signed in as {{email}}"
  }
} as const;
