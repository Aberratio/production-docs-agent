/**
 * The origin to post the embed's height message to: the parent page's origin when the browser
 * tells us (location.ancestorOrigins in Chromium/Safari, else the referrer), otherwise '*' —
 * acceptable because the message carries nothing but a pixel height.
 */
export function parentOrigin(
  ancestorOrigins: ArrayLike<string> | undefined,
  referrer: string,
): string {
  const ancestor = ancestorOrigins?.[0];
  if (ancestor && ancestor !== 'null') return ancestor;
  try {
    const origin = new URL(referrer).origin;
    return origin === 'null' ? '*' : origin;
  } catch {
    return '*';
  }
}
