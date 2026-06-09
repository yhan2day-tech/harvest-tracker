# Harvest Tracker

Harvest Tracker is a free offline-first PWA for recording hydroponic planting locations and calculating expected harvest dates 45 days later.

## Features

- Greenhouse, NFT, PVC wall, tower, and channel location lists
- Automatic 45-day expected harvest calculation
- Due, overdue, and due-soon status
- Local browser storage with migration from the original ZIP version
- Optional Android notifications checked when the app opens or returns to the foreground
- Offline PWA installation

Browser-only apps cannot guarantee a notification exactly 45 days later while fully closed. Harvest Tracker checks due dates whenever it is opened, returns to the foreground, and hourly while it remains open.
