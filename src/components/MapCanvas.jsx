import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// Fallback view until (or unless) a real fix arrives.
const FALLBACK = {
  latitude: -1.2921,
  longitude: 36.8219, // Nairobi
  // Street level — close enough to read the block you're standing on.
  latitudeDelta: 0.0035,
  longitudeDelta: 0.0035,
};

/** Camera zoom held while following the device. */
const FOLLOW_ZOOM = 16.5;

// Light raster basemap with street and place labels — the labels give the map
// somewhere to read as a place. Needs no API key of its own.
const TILE_URL = "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";

function PulseRing({ delay = 0 }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [t]);

  const style = useAnimatedStyle(() => {
    // Stagger the rings off one clock rather than two timers.
    const p = (t.value + delay) % 1;
    return {
      opacity: 0.28 * (1 - p),
      transform: [{ scale: 0.3 + p * 2.6 }],
    };
  });

  return (
    <Animated.View
      style={style}
      className="absolute h-24 w-24 rounded-full bg-[#2563EB]"
    />
  );
}

/**
 * Live map with a pulsing beacon.
 *
 * The camera follows the device, so the beacon is drawn as a centred overlay
 * rather than a map Marker: animating a Marker's child forces Android to
 * re-rasterise the pin every frame, which stutters badly.
 */
export default function MapCanvas() {
  const mapRef = useRef(null);
  const firstFix = useRef(true);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    let subscription;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== "granted") {
        setGranted(false);
        return;
      }
      setGranted(true);

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 3000,
        },
        ({ coords }) => {
          const center = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          // Pin the zoom on the first fix so arriving at the real location
          // doesn't leave the camera at the wide fallback framing.
          const camera = firstFix.current
            ? { center, zoom: FOLLOW_ZOOM }
            : { center };
          firstFix.current = false;

          mapRef.current?.animateCamera(camera, { duration: 800 });
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return (
    <View className="absolute inset-0 bg-brand-white">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={FALLBACK}
        // `none` suppresses the built-in basemap so only the tiles below draw.
        mapType={Platform.OS === "android" ? "none" : "standard"}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <UrlTile urlTemplate={TILE_URL} maximumZ={19} tileSize={512} zIndex={-1} />
      </MapView>

      {/* Beacon — centred because the camera tracks the device. */}
      <View
        className="absolute inset-0 items-center justify-center"
        pointerEvents="none"
      >
        <PulseRing />
        <PulseRing delay={0.5} />
        <View
          className="h-[18px] w-[18px] rounded-full border-[3px] border-white bg-[#2563EB]"
          style={{
            shadowColor: "#000000",
            shadowOpacity: 0.25,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 5,
            opacity: granted ? 1 : 0.55,
          }}
        />
      </View>
    </View>
  );
}
