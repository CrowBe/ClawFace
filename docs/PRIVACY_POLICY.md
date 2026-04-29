# ClawFace Privacy Policy

Last updated: 2026-04-29

ClawFace ("the App") is an AI agent operations app that provides a mobile command surface for supervising, messaging, and safely directing work across trusted AI agents. This Privacy Policy explains what information ClawFace collects, how it is used, and how it is protected.

---

## 1. Information We Collect

### 1.1 Information stored on your device only

ClawFace is designed as a **local-first** application. By default, the following data is stored exclusively on your device and is never transmitted to ClawFace servers:

- **Paired agent metadata**: Agent names, identifiers, connection settings, and Agent Context (repo path, branch, session identifiers)
- **Session keys and device tokens**: Cryptographic credentials for authenticated connections with paired agents, stored in platform-secure storage (Android Keystore / iOS Keychain) via SecureStore
- **Ed25519 device identity keys**: Per-agent cryptographic signing keys used for secure pairing, stored in platform-secure storage
- **Thread and message history**: Conversation content, tool-call results, and approval decisions from your agent interactions
- **App preferences**: Notification settings, per-agent permission configurations, and UI preferences

### 1.2 Information collected when using optional hosted features

If you choose to use optional hosted features (such as a hosted relay for remote access or push notifications), the hosted service may process:

- **Account identifiers**: Account ID, device ID, agent ID
- **Connection metadata**: Connection presence, relay routing metadata, coarse timestamps
- **Push notification tokens**: Device tokens for notification delivery (via Expo Notifications / Firebase Cloud Messaging)
- **Plan and entitlement state**: Subscription tier for quota enforcement

The hosted service is designed as a **routing-only control plane**. It does **not** store or access:

- Source code, prompts, or agent responses
- Full chat transcripts or message content
- Tool arguments, command outputs, or file paths
- Environment variables or secrets
- Session keys or cryptographic credentials

### 1.3 Information collected automatically

- **Crash reports**: If crash reporting is enabled, anonymised crash data (stack traces, device model, OS version) may be collected to improve app stability. No message content or session keys are included.

---

## 2. How We Use Information

- **On-device data** is used solely to provide the App's functionality: pairing with agents, displaying threads, sending messages, and resolving approval requests.
- **Hosted relay metadata** (when applicable) is used to route control messages between your phone and your paired agents when they are not on the same network.
- **Push notification tokens** are used to deliver notifications about approval requests and agent events.
- **Crash data** is used to diagnose and fix bugs.

We do not sell, rent, or share your personal data with third parties for advertising or marketing purposes.

---

## 3. Data Security

ClawFace employs multiple layers of security:

- **Transport encryption**: All production connections use TLS (WSS). Cleartext traffic is disabled in production Android builds.
- **Credential storage**: Session keys, device tokens, and cryptographic identity seeds are stored in platform-secure storage (Android Keystore / iOS Keychain), not in general app storage.
- **Pairing security**: Server fingerprint verification during pairing prevents man-in-the-middle attacks. Ed25519 signed challenge handshakes authenticate device identity.
- **Replay protection**: Approval decisions include unique request identifiers (UUID v4) to prevent replay attacks.
- **Session revocation**: Unpairing an agent revokes the session credential server-side and deletes local keys.

When the optional hosted relay is launched, message payloads should be encrypted end-to-end so that the relay infrastructure cannot read message content (see §6).

---

## 4. Data Retention

- **On-device data** is retained until you unpair an agent, sign out, or uninstall the App. You control this entirely.
- **Hosted relay metadata** (when applicable) is retained only as long as needed for routing and presence. Approval and event metadata retention is bounded by your subscription plan.
- **Push notification tokens** are retained while your device is registered for notifications and are deleted when you sign out or uninstall.

---

## 5. Your Rights and Choices

- **Delete your data**: Unpair agents to revoke sessions and delete associated credentials. Sign out or uninstall the App to remove all local data.
- **Opt out of notifications**: Disable push notifications in the App's settings or your device's system settings.
- **Local-only mode**: You can use ClawFace entirely in local/direct mode without any hosted services. No data leaves your device in this configuration.

---

## 6. End-to-End Encryption

When the optional hosted relay is launched, ClawFace is intended to support end-to-end encryption for message payloads. In this mode:

- Message content is encrypted on your device before transmission and decrypted only on the receiving device.
- The hosted relay sees only routing metadata (agent ID, thread ID, direction, timestamp) and encrypted payload blobs.
- The relay should not be able to read, log, or process message content, code, prompts, tool outputs, or secrets.

---

## 7. Children's Privacy

ClawFace is not directed at children under 13. We do not knowingly collect personal information from children under 13.

---

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted in the App's documentation and, where appropriate, notified through the App.

---

## 9. Contact

If you have questions about this Privacy Policy or your data, contact: benny_crow91@hotmail.com
