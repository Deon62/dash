import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ExternalLink, X } from "lucide-react-native";

import { materialUrl, openMaterial } from "@/lib/materials";
import { COLORS } from "@/theme/colors";
import { impact } from "@/lib/haptics";

/**
 * Reading a filed image or PDF without leaving the app.
 *
 * These used to be handed to `WebBrowser`, which meant the way to look at your
 * own lecture slides was to be thrown out of the app into a browser tab — the
 * file arrives with a URL bar above it, no title, and a back button that goes
 * somewhere else. Coursework a student filed here should open here.
 *
 * The bytes live in a private bucket, so everything shown is a signed link
 * minted for this viewing and expiring shortly after. It is never put in front
 * of the student; it goes straight into the page below.
 *
 * How each kind is drawn:
 *
 *   - Images: our own one-line HTML page. It could have been a native `Image`,
 *     but that gives no way to zoom, and a photographed page of handwriting is
 *     unreadable without one. The WebView's own pinch and double-tap are worth
 *     more here than the native view.
 *
 *   - PDFs on iOS: the URL, straight into the WebView. WKWebView renders PDFs
 *     itself, with paging and zoom already right.
 *
 *   - PDFs on Android: pdf.js, because the Android WebView renders nothing at
 *     all for `application/pdf`. It offers to download it instead, which is
 *     precisely the eviction this screen exists to stop.
 *
 * Anything that still refuses to draw falls back to the system browser rather
 * than to a dead end.
 */

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

/** The page an image is shown on: centred, dark, and zoomable. */
const imagePage = (url) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=6, user-scalable=yes">
<style>
  html, body { margin: 0; height: 100%; background: #09090B; }
  body { display: flex; align-items: center; justify-content: center; }
  img { max-width: 100%; max-height: 100%; display: block; }
</style>
</head>
<body>
<img src="${url}" onload="done()" onerror="report()">
<script>
  function send(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function done() {
    send({ ready: true });
  }

  function report() {
    send({ error: "That image could not be loaded." });
  }
</script>
</body>
</html>`;

/**
 * The page a PDF is drawn on, on Android.
 *
 * Every page is rendered up front rather than lazily as it scrolls into view.
 * Course PDFs are lecture slides and past papers — tens of pages, not hundreds
 * — and a student flicking to the end of a paper should not meet a blank
 * rectangle that fills itself in a second later. `SCALE` caps the backing
 * resolution so a phone rendering an A4 page at full device pixel ratio does
 * not spend its memory on detail no screen can show.
 */
const pdfPage = (url) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=6, user-scalable=yes">
<style>
  html, body { margin: 0; background: #09090B; }
  #pages { padding: 8px 0 24px; }
  canvas { display: block; margin: 0 auto 10px; max-width: 100%; background: #FFFFFF; }
</style>
</head>
<body>
<div id="pages"></div>
<script src="${PDFJS}/pdf.min.js"></script>
<script>
  var SCALE = Math.min(window.devicePixelRatio || 1, 2);

  function send(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function report(message) {
    send({ error: message });
  }

  (function () {
    if (!window.pdfjsLib) {
      report("The PDF reader could not be loaded. You may be offline.");
      return;
    }

    // Cross-origin worker scripts cannot be constructed as Workers, so this
    // is expected to fail and fall back to pdf.js's own main-thread renderer.
    // Naming it anyway costs nothing and uses the real worker wherever the
    // browser does allow it.
    pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS}/pdf.worker.min.js";

    pdfjsLib
      .getDocument("${url}")
      .promise.then(function (pdf) {
        var container = document.getElementById("pages");
        var width = container.clientWidth;

        var draw = function (number) {
          if (number > pdf.numPages) return null;

          return pdf.getPage(number).then(function (page) {
            var base = page.getViewport({ scale: 1 });
            var viewport = page.getViewport({ scale: (width / base.width) * SCALE });

            var canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = width + "px";
            container.appendChild(canvas);

            return page
              .render({ canvasContext: canvas.getContext("2d"), viewport: viewport })
              .promise.then(function () {
                // The first page is what the student is looking at. The rest
                // can arrive under them while they read it.
                if (number === 1) send({ ready: true });
                return draw(number + 1);
              });
          });
        };

        return draw(1);
      })
      .catch(function () {
        report("This PDF could not be opened.");
      });
  })();
</script>
</body>
</html>`;

export default function MaterialViewer({ material, onClose }) {
  const insets = useSafeAreaInsets();

  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const kind = material?.kind;
  const materialId = material?.id;

  // A link per viewing. They expire, so one fetched when the list was built
  // would be dead by the time anybody tapped it.
  useEffect(() => {
    if (!materialId) return undefined;

    let live = true;
    setUrl(null);
    setError(null);
    setReady(false);

    materialUrl(materialId).then((result) => {
      if (!live) return;
      if (result.error) setError(result.error);
      else setUrl(result.url);
    });

    return () => {
      live = false;
    };
  }, [materialId]);

  const source = useMemo(() => {
    if (!url) return null;

    // Android loads an HTML string with no base URL, which gives the page a
    // null origin — and a null origin cannot fetch the file the page exists to
    // show, whatever CORS headers storage returns. Handing it the file's own
    // origin makes pdf.js's request a same-origin one.
    const baseUrl = url.match(/^https?:\/\/[^/]+/)?.[0] ?? "";

    if (kind === "image") return { html: imagePage(url), baseUrl };
    // iOS renders a PDF from its URL by itself; Android has to be taught how.
    if (Platform.OS === "ios") return { uri: url };
    return { html: pdfPage(url), baseUrl };
  }, [url, kind]);

  const openOutside = useCallback(async () => {
    if (!materialId) return;
    impact("light");
    await openMaterial(materialId);
  }, [materialId]);

  const waiting = Boolean(material) && !error && (!source || !ready);

  return (
    <Modal
      visible={Boolean(material)}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "#09090B" }}>
        {/* Dark chrome, because everything under it is dark. The title is here
            so the file is identified by what the student called it rather than
            by a storage key. */}
        <View
          style={{ paddingTop: insets.top + 6 }}
          className="flex-row items-center gap-x-2 px-3 pb-3"
        >
          <Pressable
            onPress={() => {
              impact("light");
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
          >
            <X size={19} color="#FFFFFF" strokeWidth={1.8} />
          </Pressable>

          <Text
            numberOfLines={1}
            className="flex-1 font-jk-med text-[14.5px] text-white"
          >
            {material?.title ?? ""}
          </Text>

          {/* Kept in the header rather than only on failure: a student who
              wants the file in their own reader — to print it, to keep it —
              should not have to make this screen break first. */}
          <Pressable
            onPress={openOutside}
            accessibilityRole="button"
            accessibilityLabel="Open outside the app"
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
          >
            <ExternalLink size={17} color="#A1A1AA" strokeWidth={1.8} />
          </Pressable>
        </View>

        {error ? (
          <View className="flex-1 items-center justify-center px-10">
            <Text className="font-jk text-[13.5px] leading-[20px] text-center text-[#A1A1AA]">
              {error}
            </Text>
            <Pressable
              onPress={openOutside}
              accessibilityRole="button"
              className="mt-5 rounded-full bg-white/10 px-4 py-2 active:opacity-60"
            >
              <Text className="font-jk-med text-[13px] text-white">
                Open it outside the app
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1">
            {source ? (
              <WebView
                source={source}
                originWhitelist={["*"]}
                style={{ flex: 1, backgroundColor: "#09090B" }}
                // The signed link is a bearer credential. Keeping it out of
                // shared cookie and cache storage keeps it to this viewing.
                incognito
                setBuiltInZoomControls
                setDisplayZoomControls={false}
                scalesPageToFit={false}
                javaScriptEnabled
                domStorageEnabled
                // Only for the pages we do not write ourselves. Our own two
                // say when they have something to look at, which is later than
                // "the document loaded" — on Android that moment is a dark
                // rectangle with the first PDF page still rendering into it.
                onLoadEnd={() => {
                  if (source.uri) setReady(true);
                }}
                onError={() => setError("This file could not be opened here.")}
                onMessage={(event) => {
                  try {
                    const said = JSON.parse(event.nativeEvent.data);
                    if (said?.error) setError(said.error);
                    if (said?.ready) setReady(true);
                  } catch {
                    // A message we did not send. Nothing to do with it.
                  }
                }}
              />
            ) : null}

            {waiting ? (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator color={COLORS.faint} />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}
