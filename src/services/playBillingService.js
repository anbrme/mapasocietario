import { Capacitor, registerPlugin } from '@capacitor/core';

export const ANDROID_DD_PRODUCT_IDS = {
  basic: 'dd_report_basic',
  financialStatements: 'dd_report_with_financials',
};

const PlayBilling = registerPlugin('PlayBilling');

export const isAndroidNativeApp = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function queryAndroidBillingProducts() {
  if (!isAndroidNativeApp()) return [];
  const result = await PlayBilling.queryProducts({
    productIds: Object.values(ANDROID_DD_PRODUCT_IDS),
  });
  return result.products || [];
}

export async function purchaseAndroidReport({ includeFinancialStatements }) {
  if (!isAndroidNativeApp()) {
    throw new Error('Google Play Billing is only available in the Android app.');
  }

  const productId = includeFinancialStatements
    ? ANDROID_DD_PRODUCT_IDS.financialStatements
    : ANDROID_DD_PRODUCT_IDS.basic;

  const result = await PlayBilling.purchase({ productId });
  const purchase = (result.purchases || []).find(item =>
    (item.products || []).includes(productId)
  );

  if (!purchase?.purchaseToken) {
    throw new Error('Google Play did not return a purchase token.');
  }

  return { productId, purchase };
}

export async function consumeAndroidPurchase(purchaseToken) {
  return PlayBilling.consumePurchase({ purchaseToken });
}

export async function acknowledgeAndroidPurchase(purchaseToken) {
  return PlayBilling.acknowledgePurchase({ purchaseToken });
}
