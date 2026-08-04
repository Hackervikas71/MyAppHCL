import { Platform, View, StyleSheet } from "react-native";
import { useMemo } from "react";
import type { ComponentType } from "react";

type Marker = { lat: number; lng: number; label?: string; color?: string; you?: boolean };

type Props = {
  center: { lat: number; lng: number };
  markers?: Marker[];
  zoom?: number;
  height?: number | string;
  interactive?: boolean;
  route?: { lat: number; lng: number }[];
};

// Lazy-load WebView on native only. On web we fall back to an iframe.
let WebViewComp: ComponentType<any> | null = null;
if (Platform.OS !== "web") {
  try {
    WebViewComp = require("react-native-webview").WebView;
  } catch {
    WebViewComp = null;
  }
}

function buildHtml({ center, markers = [], zoom = 14, interactive = true, route }: Props) {
  const mks = JSON.stringify(markers);
  const rt = JSON.stringify(route || []);
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map { margin:0; padding:0; height:100%; width:100%; background:#FFFFFF; }
  .leaflet-container { background:#FFFFFF; }
  .pin { font-family: -apple-system, sans-serif; font-weight:700; color:#fff; padding:6px 10px; border-radius:14px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); font-size:11px; white-space:nowrap; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false, dragging: ${interactive}, tap: ${interactive}, scrollWheelZoom: ${interactive}, doubleClickZoom: ${interactive}, touchZoom: ${interactive} }).setView([${center.lat}, ${center.lng}], ${zoom});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
  var markers = ${mks};
  markers.forEach(function(m) {
    var color = m.color || (m.you ? '#22C55E' : '#FF6A00');
    var icon = L.divIcon({ className: '', html: '<div class="pin" style="background:'+color+'">'+(m.label||'')+'</div>', iconSize: null, iconAnchor: [20, 12] });
    L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
  });
  var rt = ${rt};
  if (rt.length > 1) {
    L.polyline(rt.map(function(p){return [p.lat, p.lng];}), { color: '#FF6A00', weight: 4, opacity: 0.85 }).addTo(map);
  }
</script>
</body></html>`;
}

export default function MapView(props: Props) {
  const { height = "100%" } = props;
  const html = useMemo(() => buildHtml(props), [JSON.stringify(props.center), JSON.stringify(props.markers), props.zoom, props.interactive, JSON.stringify(props.route)]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.wrap, { height: height as any }]}>
        <iframe
          title="map"
          srcDoc={html}
          style={{ border: 0, width: "100%", height: "100%", backgroundColor: "#121212" } as any}
        />
      </View>
    );
  }

  if (!WebViewComp) {
    return <View style={[styles.wrap, { height: height as any }]} />;
  }

  const WV = WebViewComp;
  return (
    <View style={[styles.wrap, { height: height as any }]}>
      <WV
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", backgroundColor: "#FFFFFF", overflow: "hidden" },
  web: { flex: 1, backgroundColor: "#FFFFFF" },
});
