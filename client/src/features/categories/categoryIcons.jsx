import React from 'react';
import {
  Tag,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  HeartPulse,
  GraduationCap,
  Film,
  Briefcase,
  Gift,
  Coffee,
  Home,
  Plane,
  Smartphone,
  Wrench,
  Laptop
} from 'lucide-react';

export const ICON_MAP = {
  tag: Tag,
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  film: Film,
  briefcase: Briefcase,
  gift: Gift,
  coffee: Coffee,
  home: Home,
  plane: Plane,
  smartphone: Smartphone,
  wrench: Wrench,
  laptop: Laptop
};

export const AVAILABLE_CATEGORY_ICONS = [
  { id: 'tag', label: 'Tag', icon: Tag },
  { id: 'utensils', label: 'Dining', icon: Utensils },
  { id: 'car', label: 'Transport', icon: Car },
  { id: 'shopping-bag', label: 'Shopping', icon: ShoppingBag },
  { id: 'receipt', label: 'Bills', icon: Receipt },
  { id: 'heart-pulse', label: 'Health', icon: HeartPulse },
  { id: 'graduation-cap', label: 'Education', icon: GraduationCap },
  { id: 'film', label: 'Entertainment', icon: Film },
  { id: 'briefcase', label: 'Work', icon: Briefcase },
  { id: 'gift', label: 'Gifts', icon: Gift },
  { id: 'coffee', label: 'Café', icon: Coffee },
  { id: 'home', label: 'Housing', icon: Home },
  { id: 'plane', label: 'Travel', icon: Plane },
  { id: 'smartphone', label: 'Mobile', icon: Smartphone },
  { id: 'wrench', label: 'Repairs', icon: Wrench },
  { id: 'laptop', label: 'Tech', icon: Laptop }
];

export const AVAILABLE_CATEGORY_COLORS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Slate', hex: '#64748B' }
];

export function getCategoryIcon(iconName) {
  if (!iconName) return Tag;
  const normalized = String(iconName).toLowerCase().trim();
  return ICON_MAP[normalized] || Tag;
}
