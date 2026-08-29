/**
 * How far type is allowed to grow with the system font setting.
 *
 * React Native scales every `<Text>` with the OS accessibility setting by
 * default, and this app sizes everything in fixed pixels with fixed leading —
 * `text-[14.5px] leading-[21px]` and so on. At the 130% several Android OEMs
 * ship out of the box, and the 200% the accessibility settings allow, anything
 * inside a fixed-height container overflows it. That is not hypothetical on
 * the hardware this app is written for.
 *
 * The answer is not to switch scaling off. A student who has set large text
 * has said what they need, and an app that ignores it is an app they cannot
 * read. The answer is to be clear about which text is *content* and which is
 * *furniture*:
 *
 * - **Content scales freely.** The tutor's answers, note bodies, questions,
 *   headings, anything being read. No cap at all — this is the text the
 *   setting exists for.
 * - **Furniture is capped.** Tab labels, pill chips, badges, button labels:
 *   text whose job is to identify a control, inside a box sized around one
 *   line of it. Past a point these stop being more readable and start being
 *   clipped, which is less readable than where they began.
 */

/**
 * The cap for furniture.
 *
 * 1.2 rather than 1.0 so the setting still does something everywhere — a
 * control that ignores it entirely, next to body text that grew by half, reads
 * as a bug. Roughly the most a single-line pill can take before its own
 * padding stops containing it.
 */
export const CHROME_SCALE = 1.2;

/**
 * A harder cap, for text in a container whose height cannot move at all.
 *
 * The tab bar is the case: `TAB_BAR_HEIGHT` is a constant that the layout
 * elsewhere reserves space against, so a label that grows pushes the icon out
 * of the bar rather than making the bar taller.
 */
export const FIXED_SCALE = 1.1;
