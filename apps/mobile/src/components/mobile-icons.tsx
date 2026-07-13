import Ionicons from "@expo/vector-icons/Ionicons";

type MobileIconName =
  | "marketplace"
  | "search"
  | "categories"
  | "myAds"
  | "profile"
  | "add"
  | "favorites"
  | "notifications"
  | "settings"
  | "signOut"
  | "filter"
  | "sort"
  | "location"
  | "chevron"
  | "cars"
  | "realestate"
  | "electronics"
  | "services"
  | "furniture"
  | "jobs"
  | "time"
  | "image"
  | "report"
  | "share"
  | "call"
  | "chat"
  | "views"
  | "trash";

type MobileIconProps = {
  name: MobileIconName;
  size?: number;
  color: string;
  focused?: boolean;
};

const iconMap: Record<MobileIconName, { inactive: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }> = {
  marketplace: { inactive: "storefront-outline", active: "storefront" },
  search: { inactive: "search-outline", active: "search" },
  categories: { inactive: "grid-outline", active: "grid" },
  myAds: { inactive: "albums-outline", active: "albums" },
  profile: { inactive: "person-circle-outline", active: "person-circle" },
  add: { inactive: "add", active: "add" },
  favorites: { inactive: "heart-outline", active: "heart" },
  notifications: { inactive: "notifications-outline", active: "notifications" },
  settings: { inactive: "settings-outline", active: "settings" },
  signOut: { inactive: "log-out-outline", active: "log-out" },
  filter: { inactive: "options-outline", active: "options" },
  sort: { inactive: "swap-vertical-outline", active: "swap-vertical" },
  location: { inactive: "location-outline", active: "location" },
  chevron: { inactive: "chevron-forward", active: "chevron-forward" },
  cars: { inactive: "car-sport-outline", active: "car-sport" },
  realestate: { inactive: "business-outline", active: "business" },
  electronics: { inactive: "phone-portrait-outline", active: "phone-portrait" },
  services: { inactive: "hammer-outline", active: "hammer" },
  furniture: { inactive: "bed-outline", active: "bed" },
  jobs: { inactive: "briefcase-outline", active: "briefcase" },
  time: { inactive: "time-outline", active: "time" },
  image: { inactive: "image-outline", active: "image" },
  report: { inactive: "flag-outline", active: "flag" },
  share: { inactive: "share-social-outline", active: "share-social" },
  call: { inactive: "call-outline", active: "call" },
  chat: { inactive: "chatbubble-ellipses-outline", active: "chatbubble-ellipses" },
  views: { inactive: "eye-outline", active: "eye" },
  trash: { inactive: "trash-outline", active: "trash" }
};

export function MobileIcon({ name, color, size = 20, focused = false }: MobileIconProps) {
  const iconName = focused ? iconMap[name].active : iconMap[name].inactive;

  return <Ionicons name={iconName} size={size} color={color} />;
}
