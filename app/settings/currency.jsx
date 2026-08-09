import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import Screen from "@/components/Screen";
import SettingsHeader from "@/components/SettingsHeader";
import { COUNTRIES, flagEmoji } from "@/theme/countries";
import { detectCountry } from "@/lib/geo";
import { useTransitStore } from "@/store/useTransitStore";
import { impact } from "@/lib/haptics";

export default function CurrencySettingsScreen() {
  const currency = useTransitStore((s) => s.settings.currency);
  const updateSettings = useTransitStore((s) => s.updateSettings);
  const [suggested, setSuggested] = useState(null);

  // Prefill from where the user actually is, rather than making them hunt.
  useEffect(() => {
    let cancelled = false;
    detectCountry().then((iso) => {
      if (cancelled) return;
      const match = COUNTRIES.find((c) => c.iso === iso);
      if (match) setSuggested(match);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One row per currency, not per country — the euro would otherwise appear
  // seven times. Each row names a representative country for its flag.
  const options = useMemo(() => {
    const seen = new Map();
    for (const country of COUNTRIES) {
      if (!country.currency || seen.has(country.currency)) continue;
      seen.set(country.currency, country);
    }
    return [...seen.values()];
  }, []);

  const ordered = useMemo(() => {
    if (!suggested) return options;
    const rest = options.filter((c) => c.currency !== suggested.currency);
    const head = options.find((c) => c.currency === suggested.currency);
    return head ? [head, ...rest] : options;
  }, [options, suggested]);

  return (
    <Screen>
      <SettingsHeader eyebrow="FARES" title="Currency" />

      {suggested && suggested.currency !== currency ? (
        <Pressable
          onPress={() => {
            impact("light");
            updateSettings({ currency: suggested.currency });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Use ${suggested.currency}`}
          className="flex-row items-center rounded-2xl bg-brand-black px-4 py-3.5 active:opacity-85"
        >
          <Text className="text-[18px]">{flagEmoji(suggested.iso)}</Text>
          <Text className="font-jk-semi text-brand-white text-[13px] flex-1 ml-3">
            Detected {suggested.name}
          </Text>
          <Text className="font-jk-bold text-brand-white text-[13px]">
            Use {suggested.currency}
          </Text>
        </Pressable>
      ) : null}

      <View className="rounded-2xl border border-brand-hairline bg-white overflow-hidden">
        {ordered.map((country, index) => {
          const selected = country.currency === currency;
          return (
            <Pressable
              key={country.currency}
              onPress={() => {
                impact("light");
                updateSettings({ currency: country.currency });
              }}
              accessibilityRole="button"
              accessibilityLabel={country.currency}
              accessibilityState={selected ? { selected: true } : {}}
              className={`flex-row items-center px-4 py-3.5 active:bg-brand-black/[0.04] ${
                index > 0 ? "border-t border-brand-hairline" : ""
              }`}
            >
              <Text className="text-[18px] w-8">{flagEmoji(country.iso)}</Text>
              <Text
                className={`w-14 text-[14px] ${
                  selected
                    ? "font-jk-black text-brand-black"
                    : "font-jk-bold text-brand-slate"
                }`}
              >
                {country.currency}
              </Text>
              <Text className="font-jk text-brand-muted text-[12px] flex-1">
                {country.name}
              </Text>
              {selected ? (
                <Check size={16} color="#09090B" strokeWidth={2.6} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
