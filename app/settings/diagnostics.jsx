import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Bug, Copy, Trash2 } from "lucide-react-native";

import Screen from "@/components/Screen";
import ScreenHeader from "@/components/ScreenHeader";
import EmptyState from "@/components/EmptyState";
import IconButton from "@/components/IconButton";
import { API_BASE_URL } from "@/api/client";
import { clearFailures, failuresAsText, useFailures } from "@/lib/diagnostics";
import { COLORS } from "@/theme/colors";
import { impact, notify } from "@/lib/haptics";

/** `2026-08-29T14:03:11.482Z` is not a thing to read down a list of twenty. */
function clockTime(iso) {
  const at = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

/**
 * What a failure is called in one word.
 *
 * Status 0 means the request never got an answer, which is a different problem
 * from any status the server chose to send, and the one most often mistaken
 * for a server bug when it is a network or a base URL.
 */
function statusLabel(status) {
  if (status === 0) return "NO REPLY";
  return String(status);
}

function statusTone(status) {
  if (status === 0) return COLORS.flame;
  if (status === 401 || status === 403) return COLORS.violet;
  return COLORS.danger;
}

function Row({ entry }) {
  const [open, setOpen] = useState(false);

  return (
    <Pressable
      onPress={() => {
        impact("light");
        setOpen((current) => !current);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${entry.method} ${entry.path}, ${statusLabel(entry.status)}`}
      className="border-b border-hairline py-3.5 active:opacity-60"
    >
      <View className="flex-row items-center">
        <Text
          style={{ color: statusTone(entry.status) }}
          className="font-jk-semi text-[11px] w-[68px]"
        >
          {statusLabel(entry.status)}
        </Text>
        <Text className="font-jk-med text-ink text-[13px] flex-1" numberOfLines={1}>
          {entry.method} {entry.path}
        </Text>
        <Text className="font-jk text-faint text-[11px] ml-2">
          {clockTime(entry.at)}
        </Text>
      </View>

      <Text className="font-jk text-muted text-[12px] leading-[17px] mt-1 ml-[68px]">
        {entry.message}
        {entry.durationMs === null ? "" : `  ·  ${entry.durationMs}ms`}
      </Text>

      {/* The body is behind a tap: it is the thing you eventually need and
          never the thing you are scanning for, and one HTML error page
          unfolded would push every other failure off the screen. */}
      {open && entry.detail ? (
        <View className="bg-surface rounded-xl px-3 py-2.5 mt-2.5 ml-[68px]">
          <Text
            selectable
            className="font-jk text-ink text-[11px] leading-[16px]"
          >
            {entry.detail}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * What failed, on the phone, without opening the server logs.
 *
 * Reachable from Settings only while `SHOW_DIAGNOSTICS` is on. It reads the
 * in-memory log in `src/lib/diagnostics.js`, so it is empty on a fresh launch
 * and can only ever show what has gone wrong since.
 */
export default function DiagnosticsScreen() {
  const failures = useFailures();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    impact("medium");
    await Clipboard.setStringAsync(
      `Base URL: ${API_BASE_URL}\n\n${failuresAsText(failures)}`
    );
    notify("success");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Screen bare>
      <ScreenHeader
        title="Diagnostics"
        right={
          failures.length > 0 ? (
            <View className="flex-row gap-x-1">
              <IconButton Icon={Copy} label="Copy all failures" onPress={copy} />
              <IconButton
                Icon={Trash2}
                label="Clear the log"
                onPress={() => {
                  impact("light");
                  clearFailures();
                }}
              />
            </View>
          ) : null
        }
      />

      {/* Which server this build is actually talking to. More failures trace
          back to this line being wrong than to anything the server did. */}
      <View className="bg-surface rounded-xl px-3.5 py-3 mb-1">
        <Text className="font-jk text-muted text-[11px]">API BASE URL</Text>
        <Text selectable className="font-jk-med text-ink text-[12.5px] mt-1">
          {API_BASE_URL}
        </Text>
      </View>

      {copied ? (
        <Text className="font-jk text-flame text-[12px] py-2">
          Copied to the clipboard.
        </Text>
      ) : null}

      {failures.length === 0 ? (
        <EmptyState
          Icon={Bug}
          title="Nothing has failed"
          message="Requests that fail are listed here with what the server said back. The log is kept in memory, so it starts empty every launch."
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {failures.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
          <View className="h-10" />
        </ScrollView>
      )}
    </Screen>
  );
}
