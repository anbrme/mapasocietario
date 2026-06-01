package es.mapasocietario.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);
        setupDownloadListener();
    }

    /**
     * The web app downloads PDF reports by navigating to a Worker URL that
     * responds with `Content-Disposition: attachment`. A WebView does nothing
     * with such a response unless a DownloadListener is registered — which is
     * why the in-app download button was a no-op. Wire the WebView up to
     * Android's DownloadManager so reports save to the public Downloads folder
     * with a system notification.
     *
     * The report URL is public (keyed by an unguessable sessionId), so no auth
     * is required; we still forward any WebView cookies defensively. The Worker
     * supplies the filename via Content-Disposition, which URLUtil.guessFileName
     * picks up.
     */
    private void setupDownloadListener() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                request.setTitle(fileName);
                request.setDescription("Mapa Societario report");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("Cookie", cookies);
                }

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(getApplicationContext(), "Downloading " + fileName, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(getApplicationContext(), "Download failed — please try again", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
