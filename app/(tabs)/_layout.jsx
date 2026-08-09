import { Tabs } from "expo-router";
import { ChartColumnBig, Route, Trophy } from "lucide-react-native";

import BottomTabBar from "@/components/BottomTabBar";
import ProfileTabIcon from "@/components/ProfileTabIcon";

export default function TabsLayout() {
  return (
    <Tabs
      // Each screen owns its own top spacing so full-bleed pages (the map) can
      // run under the status bar. `Icon` is a custom option read by
      // BottomTabBar; React Navigation forwards unknown options through to the
      // descriptor untouched.
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#FFFFFF" },
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Trips", Icon: Route }} />
      <Tabs.Screen name="stats" options={{ title: "Stats", Icon: ChartColumnBig }} />
      <Tabs.Screen name="badges" options={{ title: "Badges", Icon: Trophy }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", Icon: ProfileTabIcon }} />
    </Tabs>
  );
}
