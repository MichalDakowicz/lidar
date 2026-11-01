# Dedicated Ping backend — Lidar 1.6.2

Android 1.6.2 (code 12) and https://lidar-shelf.web.app use
https://ping-api.dakowicz.xyz. Version 1.6.2 keeps the existing self-hosted sign-in
storage and enables sibling sign-in with Sonar's matching local release.

The device update installed in place without clearing app data. Books remained
available, and actual sign-in handoff was confirmed in both directions between
Lidar and Sonar. Pulsar/Bazaar remain cloud clients and are blocked from
cross-backend handoff. Radar and Cellar are separate products.

The original backend cutover in 1.6.1 preserved account UUIDs and existing data.
Cloud Lidar writes remain fenced so old clients must update before saving.
Sonar's subsequent cutover matched existing rows and required no data replacement;
local Lidar data and shared settings were preserved. Backups and detailed
operational receipts remain private. After local writes, rollback requires
pausing affected writers and reconciling deltas; a URL flip alone is unsafe.

Validation: 493 tests, lint and TypeScript pass. The signed APK matches the family
certificate, contains the dedicated endpoint/public key and passes actual-secret
scans. Android installed and started without crashes. Web deploys after Android;
all exported files are checked byte for byte against live hosting. The existing
Firebase URL is retained.
