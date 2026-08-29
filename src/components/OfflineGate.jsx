import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OfflineState from "@/components/OfflineState";
import ScreenHeader from "@/components/ScreenHeader";
import { recheckOnline, useOnline } from "@/lib/useOnline";
import { pullSync } from "@/lib/sync";

/**
 * Holds a page back while there is no connection.
 *
 * A note on what this costs, because it is not free and the decision should be
 * visible to whoever reads this next.
 *
 * The store is a full local cache — notes, units, the timetable, deadlines and
 * the flashcard deck are all on the handset and all work with the radio off.
 * That is the point of `src/lib/sync.js` and it is what `RELEASE.md` describes.
 * Gating a page on connectivity therefore hides material the student already
 * has, on the phone they already have it on, in the exact situation the offline
 * design was built for — a lecture theatre basement, a matatu, a campus wifi
 * that has stopped forwarding packets.
 *
 * It is done because it was asked for, and because there is a real argument on
 * the other side: an app that looks entirely normal until one action fails
 * teaches people that the failure was the app's fault rather than the
 * connection's. Being told plainly and early is worth something.
 *
 * `NETWORK_OPTIONAL` below is the dial. Adding a route to it gives that screen
 * its cached content back without touching anything else.
 */

/**
 * Screens that keep working offline.
 *
 * Every page is gated except the one below — which is what was asked for. Add
 * a route name here to give that screen its cached content back; nothing else
 * changes. `timetable`, `units`, `archive` and the calendar are the obvious
 * first four if the trade above turns out to be the wrong one, since none of
 * them has ever needed the network to render a pixel.
 *
 * Diagnostics is not a preference. It is the page you open to find out *why*
 * everything else is showing the offline screen, and it prints the connection
 * state the gate decided on — so it is the one page that must never be gated
 * itself, or the tool disappears exactly when it is needed.
 */
export const NETWORK_OPTIONAL = new Set(["diagnostics"]);

/**
 * @param bare  A pushed screen, with no tab bar underneath. It gets a back
 *   control, because without one and without tabs there is no way off the
 *   page at all — an offline screen that traps someone is worse than the
 *   silence it replaced.
 */
export default function OfflineGate({ children, bare = false, name }) {
  const online = useOnline();
  const insets = useSafeAreaInsets();

  if (online || NETWORK_OPTIONAL.has(name)) return children;

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-canvas">
      <View className="px-5 pt-3">{bare ? <ScreenHeader /> : null}</View>

      {/* Centred in what is left rather than pinned under the header: the
          drawing is the whole message here, and a message that sits at the top
          of an otherwise empty page reads as a page that failed to finish
          loading. */}
      <View className="flex-1 justify-center">
        <OfflineState
          /* Asks the OS first, then tries to sync. The listener usually lifts
             this screen on its own the moment the radio comes back, so the
             button is for the case it cannot see — a captive portal the
             student has just signed in to, which looks identical to being
             offline until something makes a request. */
          onRetry={async () => {
            await recheckOnline();
            pullSync();
          }}
          retryLabel="Check again"
          message="This needs a connection. Nothing has been lost — everything comes straight back when you're online."
        />
      </View>
    </View>
  );
}
