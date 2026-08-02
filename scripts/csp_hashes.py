#!/usr/bin/env python3
"""Check (or repair) the CSP sha256 hashes for index.html's inline scripts.

WHY THIS EXISTS. index.html ships its Content-Security-Policy as a meta tag,
and script-src carries one 'sha256-...' per INLINE script. Adding any hash
makes a CSP3 browser ignore 'unsafe-inline' entirely — which is the point, it
is the second line of defence behind the hand-rolled esc() helpers — but it
also means that changing one byte of an inline script invalidates its hash and
the browser refuses to run it. The splash bootstrap is one of those scripts, so
the failure mode is a blank veil over an app that never boots.

That is a total failure caused by an edit that looks harmless, produces no
warning, and passes every other check in this repo: `node --check` does not see
index.html at all, and the app only breaks in a browser that enforces CSP.

Usage:
    python scripts/csp_hashes.py           # check; exit 1 if out of step
    python scripts/csp_hashes.py --write   # rewrite the meta tag in place

Standard library only, per the repository's Python constraint.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

# An inline script is a <script> WITHOUT a src attribute. The negative
# lookahead is what distinguishes it from <script type="module" src="...">,
# which CSP covers under 'self' and which must NOT get a hash.
INLINE_RE = re.compile(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", re.S)
HASH_RE = re.compile(r"'sha256-[A-Za-z0-9+/=]+'")


def digest(body: str) -> str:
    """The hash CSP expects: sha256 of the script's EXACT text content.

    Exact means exact — the bytes between > and </script>, including the
    leading and trailing newlines. Stripping whitespace here would produce a
    hash that looks right and fails in the browser.
    """
    return base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest()).decode()


def current_hashes(src: str) -> list[str]:
    """The hashes the CSP lists today, in document order."""
    csp = re.search(r'http-equiv="Content-Security-Policy"\s+content="(.*?)"', src, re.S)
    if not csp:
        raise SystemExit("index.html: no Content-Security-Policy meta tag found")
    return HASH_RE.findall(csp.group(1))


def wanted_hashes(src: str) -> list[tuple[str, str]]:
    """(label, hash) for every inline script actually present."""
    out = []
    for attrs, body in INLINE_RE.findall(src):
        label = "importmap" if "importmap" in attrs else "inline script"
        out.append((label, f"'sha256-{digest(body)}'"))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write", action="store_true",
                    help="rewrite index.html's CSP with the correct hashes")
    args = ap.parse_args()

    src = INDEX.read_text(encoding="utf-8")
    have = current_hashes(src)
    want = wanted_hashes(src)
    want_only = [h for _, h in want]

    if have == want_only:
        # ASCII only in console output: the Windows console codepage mangles an
        # em dash into a replacement character and makes a passing check look
        # like an encoding error.
        print(f"OK - {len(want)} inline script(s), all hashes match.")
        for label, h in want:
            print(f"  {label:14s} {h}")
        return 0

    print("MISMATCH - the CSP does not match index.html's inline scripts.\n")
    print("  in the CSP now:")
    for h in have:
        print(f"    {h}{'' if h in want_only else '   <- stale, no script produces this'}")
    print("  required:")
    for label, h in want:
        print(f"    {h}  ({label}){'' if h in have else '   <- MISSING'}")

    if not args.write:
        print("\nRe-run with --write to fix, or the app will not boot.")
        return 1

    # Replace the hash tokens inside the CSP only, positionally, leaving every
    # other directive (and the surrounding comments) untouched.
    csp = re.search(r'(http-equiv="Content-Security-Policy"\s+content=")(.*?)(")', src, re.S)
    body = csp.group(2)
    it = iter(want_only)
    if len(have) == len(want_only):
        new_body = HASH_RE.sub(lambda _m: next(it), body)
    else:
        # Count changed: drop every existing hash, then insert the full set
        # after script-src's 'self'.
        stripped = HASH_RE.sub("", body)
        stripped = re.sub(r"[ \t]{2,}", " ", stripped)
        new_body = stripped.replace("script-src 'self'",
                                    "script-src 'self' " + " ".join(want_only), 1)
    INDEX.write_text(src[:csp.start(2)] + new_body + src[csp.end(2):], encoding="utf-8")
    print("\nWritten. Re-run without --write to confirm.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
