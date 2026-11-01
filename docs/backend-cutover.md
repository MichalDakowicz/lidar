# Dedicated Ping backend — Lidar 1.6.1

## Sonar reciprocal sign-in update — 2026-11-01

Sonar Android 2.4.1 and its Firebase site now use the same Ping backend. The user
confirmed Google sign-in, albums and Spotify search on Android. Its six cloud
tables are fenced after backups and an exact zero-import reconciliation; local
Lidar rows, Auth/session state and shared settings were preserved. Lidar 1.6.2
(code 12) is prepared to enable sign-in with Sonar in both directions. Pulsar and
Bazaar remain cloud-backed and are excluded from local handoff; Radar/Cellar
remain separate. The reciprocal update passes 493 tests, lint and types; its
Android install and web deployment are pending.

## Original Lidar cutover evidence

Lidar Android (versionCode 11) and https://lidar-shelf.web.app use
https://ping-api.dakowicz.xyz. Google sign-in uses Ping's own production OAuth
client. Confirmation and recovery email use Resend. Frontend builds contain only
the local publishable API key; obtain it privately from the server administrator.
The new auth storage key requires a fresh sign-in after updating.

Ping consists of Lidar, Sonar, Pulsar and Bazaar. Lidar is the first migrated app;
the other three still use cloud. Radar and Cellar are separate products and their
releases/configuration were not changed. Shared account IDs, profiles, friendships,
RLS, RPCs and historical dependent tables were preserved in the import. Later
profile/friendship/account changes do not synchronize between cloud and local.
Sibling sign-in is blocked across backends and excludes Radar and Cellar.

The final cloud data snapshot was imported into the fresh `ping-live` backend on
2026-10-31. All 89 table counts matched; seven accounts/profiles and 38 Realtime
publication tables were verified. The import retained eight temporary local OAuth
flow records, with exact count checks and the original populated-target guard.
The original `main` backend and cloud project remain intact.

Cloud writes to seven Lidar book tables and its reading-streak fields are fenced.
Old clients may read cloud data but cannot save there. The copied fence was removed
only from the local backend. Seven Radar/Cellar jobs and their five Vault entries
remain cloud-owned; no duplicate local jobs were activated. Cloud account deletion
may encounter the Lidar fence and requires coordinated handling.

Validation: 493 tests, lint and TypeScript passed. The signed APK was checked for
the dedicated endpoint, local public key and absence of backend secret values;
its existing Ping family certificate matched. It installed and launched without
startup errors. The user confirmed Google sign-in and their books on the phone.
Authenticated API reads, rolled-back owner/non-owner RLS writes, ownership-change
denial, anonymous visibility, shared visibility RPC, one-time handoff redemption,
public Realtime WSS update delivery, full QR claim/approval/redemption and replay
protection, SMTP delivery and Auth recovery submission
passed. The web artifact passed the same endpoint/secret checks and deployed after
the Android check; all 24 live exported files match byte for byte. The hosting
ignore rule includes Expo assets under assets/node_modules. Web OAuth was checked for provider/redirect configuration;
the interactive Google roundtrip was verified on Android.

Rollback backups are on the server under `supabase-hosting/backups/main` and
`backups/ping-live`; migration evidence is in
`migrations/ping-live/20261031T214553Z`. Local production writes have begun: do not
roll back by changing the URL alone. Pause local Lidar writes, back up both sides
and reconcile local changes before restoring cloud writes and previous clients.
Do not restore another complete cloud dump over populated `ping-live` when moving
the next app; preserve authoritative Lidar data and reconcile shared identities.
