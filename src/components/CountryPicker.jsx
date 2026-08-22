import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Search, X } from "lucide-react-native";

import { COUNTRIES, flagEmoji, getCountry } from "@/theme/countries";
import { impact } from "@/lib/haptics";

/** Flag + dial code chip that opens a searchable country list. */
export default function CountryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const active = getCountry(value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.iso.toLowerCase() === q
    );
  }, [query]);

  const select = (iso) => {
    impact("light");
    onChange(iso);
    setQuery("");
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          impact("light");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Country code, currently ${active.name} ${active.dial}`}
        className="flex-row items-center gap-x-1.5 pr-3 mr-3 border-r border-line active:opacity-60"
      >
        <Text className="text-[18px]">{flagEmoji(active.iso)}</Text>
        <Text className="font-jk-med text-ink text-[15px]">
          {active.dial}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-ink/30">
          <Pressable className="flex-1" onPress={() => setOpen(false)} />

          <View
            style={{ paddingBottom: insets.bottom + 8, maxHeight: "78%" }}
            className="rounded-t-3xl bg-canvas"
          >
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="font-jk-semi text-ink text-[17px]">
                Country
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close country list"
                className="h-8 w-8 items-center justify-center rounded-full bg-primary/[0.05] active:opacity-70"
              >
                <X size={15} color="#52525B" strokeWidth={2.4} />
              </Pressable>
            </View>

            <View className="mx-5 mb-2 flex-row items-center rounded-2xl border border-line px-3.5">
              <Search size={16} color="#A1A1AA" strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search country or code"
                placeholderTextColor="#A1A1AA"
                autoCorrect={false}
                className="flex-1 py-3 ml-2.5 font-jk-semi text-ink text-[14px]"
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {results.map((country) => {
                const selected = country.iso === value;
                return (
                  <Pressable
                    key={country.iso}
                    onPress={() => select(country.iso)}
                    accessibilityRole="button"
                    accessibilityLabel={country.name}
                    className="flex-row items-center px-5 py-3.5 active:bg-primary/[0.04]"
                  >
                    <Text className="text-[20px] w-8">
                      {flagEmoji(country.iso)}
                    </Text>
                    <Text
                      className={`flex-1 text-[14px] ml-1 ${
                        selected
                          ? "font-jk-med text-ink"
                          : "font-jk-semi text-muted"
                      }`}
                    >
                      {country.name}
                    </Text>
                    <Text className="font-jk text-muted text-[13px] mr-3">
                      {country.dial}
                    </Text>
                    {selected ? (
                      <Check size={16} color="#09090B" strokeWidth={2.6} />
                    ) : null}
                  </Pressable>
                );
              })}

              {results.length === 0 ? (
                <Text className="font-jk text-muted text-[13px] text-center py-8">
                  No match for “{query}”.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
