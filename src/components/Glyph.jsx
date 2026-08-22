import MicSvg from "../../assets/mic.svg";
import SendSvg from "../../assets/send.svg";

/**
 * The two supplied SVGs, wrapped so they take a colour.
 *
 * Both files ship with the fill baked into the markup. They were rewritten to
 * `currentColor`, which react-native-svg resolves from the `color` prop — so
 * these behave like every Lucide icon in the app instead of being stuck at one
 * shade of near-black.
 */
export function SendGlyph({ size = 20, color }) {
  return <SendSvg width={size} height={size} color={color} />;
}

export function MicGlyph({ size = 20, color }) {
  return <MicSvg width={size} height={size} color={color} />;
}
