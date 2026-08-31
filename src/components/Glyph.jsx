import MicSvg from "../../assets/mic.svg";
import SendSvg from "../../assets/send.svg";
import VoiceSvg from "../../assets/voice.svg";

/**
 * The supplied SVGs, wrapped so they take a colour.
 *
 * Each file ships with the fill baked into the markup. They were rewritten to
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

/**
 * The waveform, for talking to the tutor rather than dictating at it.
 *
 * Deliberately not a second microphone. The mic beside it turns speech into
 * text in the field — the student still reads the answer — and this one is the
 * conversation: you speak, it speaks back. Two mics would say those were the
 * same feature, and the first thing anybody would do is wonder which one they
 * had been using all along.
 */
export function VoiceGlyph({ size = 20, color }) {
  return <VoiceSvg width={size} height={size} color={color} />;
}
