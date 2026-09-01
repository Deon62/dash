import Svg, { Path, Rect } from "react-native-svg";

/**
 * Visa and Mastercard, drawn inline.
 *
 * Both were supplied as `.svg` files in `assets/`, and both are unusable as
 * imports: their fills live in a `<style type="text/css">` block referenced by
 * `class="st0"`, and react-native-svg has no CSS engine — it reads presentation
 * attributes only. Imported as they are, each mark renders as a black
 * silhouette, which for a payment logo is worse than not showing one.
 *
 * So they follow `GoogleMark`: the same path data, with the fills moved onto
 * the elements. It is also the same reasoning about colour — a card scheme's
 * mark is theirs, reproduced as issued, and is the one place in the app where
 * the palette does not get a say.
 *
 * Both are sized by height and both are cropped to their own artwork, which is
 * what makes them sit together. Mastercard's file carries a 152.4 × 108 canvas
 * with the discs floating in the middle of it, so a `height` of 20 drew discs
 * about 13px tall — while Visa's box is tight to the wordmark and drew a full
 * 20. Same number, one mark half as big again as the other, and Visa reading as
 * though it had been zoomed in on.
 *
 * With both cropped, the remaining difference is optical rather than
 * geometric: a solid wordmark at the same height as a pair of open discs looks
 * heavier than it is. The defaults below account for that — pair them and they
 * balance.
 */

/**
 * Visa's wordmark. Its box is already tight to the letters: 262.3 × 85.
 *
 * The default is deliberately shorter than Mastercard's. A wordmark set to the
 * same cap height as the discs beside it reads noticeably larger, because it is
 * solid ink across its whole width where they are two outlines with a gap.
 */
export function VisaMark({ height = 13 }) {
  return (
    <Svg width={height * (262.3 / 85)} height={height} viewBox="0 0 262.3 85">
      <Path
        fill="#1434CB"
        d="M170.9,0c-18.6,0-35.3,9.7-35.3,27.5c0,20.5,29.5,21.9,29.5,32.1c0,4.3-5,8.2-13.4,8.2c-12,0-21-5.4-21-5.4l-3.8,18c0,0,10.3,4.6,24.1,4.6c20.4,0,36.4-10.1,36.4-28.3c0-21.6-29.6-23-29.6-32.5c0-3.4,4.1-7.1,12.5-7.1c9.5,0,17.3,3.9,17.3,3.9l3.8-17.4C191.3,3.6,182.8,0,170.9,0L170.9,0z M0.5,1.3L0,3.9c0,0,7.8,1.4,14.9,4.3c9.1,3.3,9.7,5.2,11.3,11.1l16.7,64.3h22.4L99.6,1.3H77.3l-22.1,56l-9-47.5c-0.8-5.4-5-8.5-10.2-8.5C36,1.3,0.5,1.3,0.5,1.3z M108.6,1.3L91.1,83.6h21.3l17.4-82.3L108.6,1.3L108.6,1.3z M227.2,1.3c-5.1,0-7.8,2.7-9.8,7.5l-31.2,74.8h22.3l4.3-12.5H240l2.6,12.5h19.7L245.2,1.3L227.2,1.3L227.2,1.3z M230.1,23.6l6.6,30.9H219L230.1,23.6L230.1,23.6z"
      />
    </Svg>
  );
}

/**
 * Mastercard's interlocking discs.
 *
 * The supplied file is a 152.4 × 108 canvas with the mark sitting in the middle
 * of it and roughly a fifth of the box empty on every side. That padding is
 * invisible and it is why the two logos would not line up: cropping the
 * `viewBox` to the artwork — x 18, y 18, 116.4 × 72 — means `height` finally
 * means the height of the thing you can see.
 *
 * Drawn as the file does it, two circles with the overlap painted on top in
 * orange, rather than as two translucent circles. Transparency would change the
 * colour of the intersection against anything but white, and this sits on a
 * grey well as often as not.
 */
export function MastercardMark({ height = 20 }) {
  const scale = height / 72;

  return (
    <Svg width={116.4 * scale} height={height} viewBox="18 18 116.4 72">
      <Rect x="60.4" y="25.7" width="31.5" height="56.6" fill="#FF5F00" />
      <Path
        fill="#EB001B"
        d="M62.4,54c0-11,5.1-21.5,13.7-28.3c-15.6-12.3-38.3-9.6-50.6,6.1C13.3,47.4,16,70,31.7,82.3c13.1,10.3,31.4,10.3,44.5,0C67.5,75.5,62.4,65,62.4,54z"
      />
      <Path
        fill="#F79E1B"
        d="M134.4,54c0,19.9-16.1,36-36,36c-8.1,0-15.9-2.7-22.2-7.7c15.6-12.3,18.3-34.9,6-50.6c-1.8-2.2-3.8-4.3-6-6c15.6-12.3,38.3-9.6,50.5,6.1C131.7,38.1,134.4,45.9,134.4,54z"
      />
    </Svg>
  );
}
