export const LEGACY_CHECKOUT_PHONE_PLACEHOLDER = '0000000000';

export function isCheckoutPhonePlaceholder(value: string | null | undefined) {
  return (value || '').trim() === LEGACY_CHECKOUT_PHONE_PLACEHOLDER;
}

export function getCheckoutCustomerPhoneForApi(value: string | null | undefined = '') {
  const trimmed = (value || '').trim();
  return trimmed && !isCheckoutPhonePlaceholder(trimmed)
    ? trimmed
    : LEGACY_CHECKOUT_PHONE_PLACEHOLDER;
}

export function getRazorpayPrefillContact(value: string | null | undefined) {
  const trimmed = (value || '').trim();
  return isCheckoutPhonePlaceholder(trimmed) ? '' : trimmed;
}

export function getCustomerContactLabel(phone: string | null | undefined, email: string | null | undefined) {
  const trimmedPhone = (phone || '').trim();
  if (trimmedPhone && !isCheckoutPhonePlaceholder(trimmedPhone)) {
    return trimmedPhone;
  }

  return (email || '').trim();
}
