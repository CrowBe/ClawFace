# Google Play Store Release Checklist

This checklist tracks the non-code release work for CF-028. It complements `docs/PRIVACY_POLICY.md`; it is not a product or architecture source of truth.

## Build configuration

- [x] EAS build profiles exist for `development`, `preview`, and `production`.
- [x] Production Android builds are configured to output an Android App Bundle (`.aab`).
- [x] Android package is set to `com.bcrow91.clawface` in `app.json`.
- [x] Android `versionCode` is set in `app.json`.
- [x] Production Android cleartext traffic is disabled.
- [x] Android target SDK is explicitly set to API 35 in `app.json`.
- [ ] Production build artifact confirms target SDK API 35 or higher.
- [x] Expo SDK 54 / React Native 0.81 are in use for Android 16 KB page-size compatibility.

## Play Console setup

- [ ] Google Play Developer Account created.
- [ ] Google Cloud service account created for EAS Submit.
- [ ] Service account JSON key stored securely outside the repo.
- [ ] EAS submit credentials configured for the `bcrow91` Expo account.
- [ ] Internal testing track created.

## Store listing assets

- [ ] App icon: 512 × 512 PNG.
- [ ] Feature graphic: 1024 × 500 PNG.
- [ ] At least two Android device screenshots.
- [ ] Short description drafted.
- [ ] Full description drafted.
- [ ] Contact email confirmed.
- [ ] Privacy Policy published at a public URL.

## Compliance

- [ ] Data Safety form completed. Current truthful posture: most data is on-device only; session keys/device tokens live in platform-secure storage; no third-party advertising/data sharing; data deletion via unpair/sign-out/uninstall.
- [ ] Content rating questionnaire completed.
- [ ] Target audience and content declaration completed.
- [ ] App access instructions documented if reviewers need a local Gateway pairing path.

## Validation before public release

- [ ] `npx tsc --noEmit`
- [ ] `npx eas build --platform android --profile production`
- [ ] Confirm the production `.aab` target SDK is API 35 or higher.
- [ ] Upload production `.aab` to the internal testing track.
- [ ] Install from internal testing.
- [ ] Verify local Gateway pairing.
- [ ] Verify one Thread message round-trip.
- [ ] Verify unpair/revoke behaviour.
