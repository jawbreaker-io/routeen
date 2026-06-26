import {
  House,
  Briefcase,
  Barbell,
  Star,
  ShoppingBag,
  Coffee,
  ForkKnife,
  MapPin,
} from '@phosphor-icons/react';

// jawbreaker.io "candy" place-type system — the single source of truth for the
// colour, label and Phosphor glyph used for every place type across the sidebar,
// the map markers and the analytics dashboard.
export const PLACE_TYPES = {
  home: { label: 'Home', color: '#EA2467', Icon: House },
  office: { label: 'Office', color: '#1F8FD0', Icon: Briefcase },
  exercise: { label: 'Exercise', color: '#7AB42C', Icon: Barbell },
  activities: { label: 'Activities', color: '#FFB205', Icon: Star },
  shopping: { label: 'Shopping', color: '#9B5DE5', Icon: ShoppingBag },
  third_place: { label: 'Third Place', color: '#03BBD8', Icon: Coffee },
  eatery: { label: 'Eatery', color: '#FF7A3D', Icon: ForkKnife },
  other: { label: 'Other', color: '#6c7f8d', Icon: MapPin },
};

export const PLACE_TYPE_KEYS = Object.keys(PLACE_TYPES);

export function getPlaceTypeMeta(type) {
  return PLACE_TYPES[type] || PLACE_TYPES.other;
}

export function getPlaceTypeLabel(type) {
  return getPlaceTypeMeta(type).label;
}

export function getPlaceTypeColor(type) {
  return getPlaceTypeMeta(type).color;
}

// Options for the "flavor" <select> in the add/edit place form (lowercase, candy style).
export const PLACE_TYPE_OPTIONS = PLACE_TYPE_KEYS.map((value) => ({
  value,
  label: PLACE_TYPES[value].label.toLowerCase(),
}));
