package es.mapasocietario.app;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsById = new HashMap<>();
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()
            .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) {
            billingClient.endConnection();
        }
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        JSArray ids = call.getArray("productIds", new JSArray());
        List<String> productIds = getStringList(ids);
        if (productIds.isEmpty()) {
            call.reject("productIds is required");
            return;
        }

        runWhenReady(call, () -> queryProductDetails(productIds, call, false));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null || productId.trim().isEmpty()) {
            call.reject("productId is required");
            return;
        }
        if (pendingPurchaseCall != null) {
            call.reject("A purchase is already in progress");
            return;
        }

        runWhenReady(call, () -> {
            ProductDetails details = productDetailsById.get(productId);
            if (details == null) {
                List<String> ids = new ArrayList<>();
                ids.add(productId);
                queryProductDetails(ids, call, true);
                return;
            }
            launchPurchaseFlow(call, details);
        });
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        runWhenReady(call, () -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
            billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectBilling(call, "queryPurchases failed", billingResult);
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("purchases", purchasesToArray(purchases));
                call.resolve(ret);
            });
        });
    }

    @PluginMethod
    public void consumePurchase(PluginCall call) {
        String purchaseToken = call.getString("purchaseToken");
        if (purchaseToken == null || purchaseToken.trim().isEmpty()) {
            call.reject("purchaseToken is required");
            return;
        }

        runWhenReady(call, () -> {
            ConsumeParams params = ConsumeParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build();
            billingClient.consumeAsync(params, (billingResult, token) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectBilling(call, "consumePurchase failed", billingResult);
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("purchaseToken", token);
                call.resolve(ret);
            });
        });
    }

    @PluginMethod
    public void acknowledgePurchase(PluginCall call) {
        String purchaseToken = call.getString("purchaseToken");
        if (purchaseToken == null || purchaseToken.trim().isEmpty()) {
            call.reject("purchaseToken is required");
            return;
        }

        runWhenReady(call, () -> {
            AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build();
            billingClient.acknowledgePurchase(params, billingResult -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectBilling(call, "acknowledgePurchase failed", billingResult);
                    return;
                }
                call.resolve();
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (pendingPurchaseCall == null) {
            return;
        }

        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;

        int responseCode = billingResult.getResponseCode();
        if (responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            JSObject ret = new JSObject();
            ret.put("purchases", purchasesToArray(purchases));
            call.resolve(ret);
            return;
        }

        if (responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("Purchase cancelled");
            return;
        }

        rejectBilling(call, "Purchase failed", billingResult);
    }

    private void runWhenReady(PluginCall call, Runnable action) {
        if (billingClient == null) {
            call.reject("Billing client is not initialized");
            return;
        }
        if (billingClient.isReady()) {
            action.run();
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    action.run();
                } else {
                    rejectBilling(call, "Billing setup failed", billingResult);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Automatic service reconnection is enabled for future calls.
            }
        });
    }

    private void queryProductDetails(List<String> productIds, PluginCall call, boolean launchAfterQuery) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String productId : productIds) {
            products.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            );
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(products)
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                rejectBilling(call, "queryProducts failed", billingResult);
                return;
            }

            List<ProductDetails> detailsList = result.getProductDetailsList();
            for (ProductDetails details : detailsList) {
                productDetailsById.put(details.getProductId(), details);
            }

            if (launchAfterQuery) {
                ProductDetails details = detailsList.isEmpty() ? null : detailsList.get(0);
                if (details == null) {
                    call.reject("Product is not available in Google Play");
                    return;
                }
                launchPurchaseFlow(call, details);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("products", productsToArray(detailsList));
            call.resolve(ret);
        });
    }

    private void launchPurchaseFlow(PluginCall call, ProductDetails details) {
        BillingFlowParams.ProductDetailsParams productDetailsParams =
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
                .build();

        List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
        productDetailsParamsList.add(productDetailsParams);

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build();

        pendingPurchaseCall = call;
        BillingResult result = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            pendingPurchaseCall = null;
            rejectBilling(call, "Could not launch billing flow", result);
        }
    }

    private JSArray productsToArray(List<ProductDetails> detailsList) {
        JSArray products = new JSArray();
        for (ProductDetails details : detailsList) {
            JSObject item = new JSObject();
            item.put("productId", details.getProductId());
            item.put("title", details.getTitle());
            item.put("name", details.getName());
            item.put("description", details.getDescription());
            item.put("productType", details.getProductType());

            ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
            if (offer != null) {
                item.put("formattedPrice", offer.getFormattedPrice());
                item.put("priceAmountMicros", offer.getPriceAmountMicros());
                item.put("priceCurrencyCode", offer.getPriceCurrencyCode());
            }
            products.put(item);
        }
        return products;
    }

    private JSArray purchasesToArray(List<Purchase> purchasesList) {
        JSArray purchases = new JSArray();
        if (purchasesList == null) {
            return purchases;
        }
        for (Purchase purchase : purchasesList) {
            JSObject item = new JSObject();
            JSArray products = new JSArray();
            for (String product : purchase.getProducts()) {
                products.put(product);
            }
            item.put("products", products);
            item.put("purchaseToken", purchase.getPurchaseToken());
            item.put("orderId", purchase.getOrderId());
            item.put("purchaseTime", purchase.getPurchaseTime());
            item.put("purchaseState", purchase.getPurchaseState());
            item.put("acknowledged", purchase.isAcknowledged());
            item.put("quantity", purchase.getQuantity());
            purchases.put(item);
        }
        return purchases;
    }

    private List<String> getStringList(JSArray array) {
        List<String> values = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, null);
            if (value != null && !value.trim().isEmpty()) {
                values.add(value);
            }
        }
        return values;
    }

    private void rejectBilling(PluginCall call, String prefix, BillingResult result) {
        call.reject(prefix + ": " + result.getDebugMessage(), String.valueOf(result.getResponseCode()));
    }
}
