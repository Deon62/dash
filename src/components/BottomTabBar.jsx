import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleDot } from "lucide-react-native";

import { TAB_BAR_HEIGHT } from "@/theme/layout";
import { impact } from "@/lib/haptics";

const SPRING = { damping: 16, stiffness: 240, mass: 0.6 };

function TabItem({ label, Icon, focused, onPress, onLongPress }) {
  const press = useSharedValue(1);
  const focus = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    focus.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, focus]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * (1 + focus.value * 0.06) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={() => {
        impact("light");
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={() => {
        press.value = withTiming(0.92, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, SPRING);
      }}
      // `flex-1` splits the full width evenly; the column centres the icon
      // directly over its label.
      className="flex-1 items-center justify-center"
      style={{ height: TAB_BAR_HEIGHT }}
    >
      <Animated.View style={iconStyle} className="items-center justify-center">
        <Icon
          size={23}
          color={focused ? "#09090B" : "#A1A1AA"}
          strokeWidth={focused ? 2.3 : 1.9}
        />
      </Animated.View>

      <Text
        numberOfLines={1}
        style={{ textAlign: "center" }}
        className={`mt-1.5 w-full text-[11px] ${
          focused ? "font-jk-bold text-brand-black" : "font-jk-semi text-brand-muted"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Full-width bottom navigation: opaque white, edge to edge, flat against the
 * bottom of the screen. Sits above page content rather than floating over it,
 * so nothing is ever hidden behind it.
 */
export default function BottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      className="absolute inset-x-0 bottom-0 bg-white border-t border-brand-hairline"
    >
      <View className="flex-row items-stretch">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              label={options.title ?? route.name}
              Icon={options.Icon ?? CircleDot}
              focused={focused}
              onPress={onPress}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
            />
          );
        })}
      </View>
    </View>
  );
}
