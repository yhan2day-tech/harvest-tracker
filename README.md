# Harvest Tracker

Harvest Tracker is a free offline-first PWA for recording hydroponic transplant locations and calculating expected harvest dates 35 days later.

## Features

- Greenhouse, NFT, PVC wall, tower, and channel location lists
- Automatic 35-day expected harvest calculation
- Editable transplant rows that recalculate the harvest date when revised
- Due, overdue, and due-soon status
- Local browser storage with migration from the original ZIP version
- Optional Android notifications checked when the app opens or returns to the foreground
- Offline PWA installation

Browser-only apps cannot guarantee a notification exactly 35 days later while fully closed. Harvest Tracker checks due dates whenever it is opened, returns to the foreground, and hourly while it remains open.
