import type { Category } from '../types';

function normalizeCategoryValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const CATEGORY_POSITION_RULES: Array<{
  matches: string[];
  position: number;
}> = [
  { matches: ['belgian waffles', 'belgian waffle'], position: 1 },
  { matches: ['stick waffles', 'stick waffle'], position: 2 },
  { matches: ['ice creams scoops', 'ice cream scoops', 'ice cream scoop'], position: 3 },
  { matches: ['cone waffles', 'cone waffle'], position: 4 },
];

const LAST_CATEGORY_MATCHES = ['hot dog waffle', 'hot dog waffles'];

function getPinnedPosition(category: Category) {
  const haystack = normalizeCategoryValue(`${category.name} ${category.slug}`);

  for (const rule of CATEGORY_POSITION_RULES) {
    if (rule.matches.some((match) => haystack.includes(normalizeCategoryValue(match)))) {
      return rule.position;
    }
  }

  return null;
}

function isLastCategory(category: Category) {
  const haystack = normalizeCategoryValue(`${category.name} ${category.slug}`);
  return LAST_CATEGORY_MATCHES.some((match) => haystack.includes(normalizeCategoryValue(match)));
}

export function sortCategoriesForMenu(categories: Category[]) {
  return [...categories].sort((left, right) => {
    const leftIsLast = isLastCategory(left);
    const rightIsLast = isLastCategory(right);

    if (leftIsLast !== rightIsLast) {
      return leftIsLast ? 1 : -1;
    }

    const leftPinnedPosition = getPinnedPosition(left);
    const rightPinnedPosition = getPinnedPosition(right);

    if (leftPinnedPosition !== null || rightPinnedPosition !== null) {
      if (leftPinnedPosition === null) return 1;
      if (rightPinnedPosition === null) return -1;
      if (leftPinnedPosition !== rightPinnedPosition) {
        return leftPinnedPosition - rightPinnedPosition;
      }
    }

    return left.display_order - right.display_order;
  });
}
