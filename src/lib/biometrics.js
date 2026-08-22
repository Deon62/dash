import * as LocalAuthentication from "expo-local-authentication";

/**
 * The fingerprint or face lock on the app.
 *
 * Every function returns a plain result rather than throwing, because each is
 * called from a switch or an app-state handler where an unhandled rejection
 * would take the screen down.
 *
 * This guards the *view*, not the data. Everything is in AsyncStorage, which
 * anyone with the unlocked device and a debugger can read regardless — the
 * lock is here so a borrowed phone does not show someone's coursework, and it
 * should not be described to a student as anything stronger.
 */

/** Whether the device has hardware and at least one enrolled fingerprint/face. */
export async function isAvailable() {
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && enrolled;
  } catch {
    return false;
  }
}

/** What the device actually offers, so the setting can name it. */
export async function describe() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;

    if (types.includes(FACIAL_RECOGNITION)) return "Face";
    if (types.includes(FINGERPRINT)) return "Fingerprint";
    return "Biometrics";
  } catch {
    return "Biometrics";
  }
}

/**
 * Prompts for the fingerprint or face.
 *
 * `disableDeviceFallback` is deliberately false: someone whose fingerprint
 * will not read on a cold morning still needs into their own notes, and the
 * device passcode is the escape hatch every platform already provides.
 */
export async function authenticate(reason = "Unlock ALS") {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    return { ok: result.success, error: result.success ? null : result.error };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}
