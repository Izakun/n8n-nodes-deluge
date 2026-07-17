# n8n-nodes-deluge

[![npm version](https://img.shields.io/npm/v/n8n-nodes-deluge.svg)](https://www.npmjs.com/package/n8n-nodes-deluge)

n8n community node for [Deluge](https://deluge-torrent.org/) — the BitTorrent client — via its Web JSON-RPC API.

Install via **Settings -> Community Nodes -> Install** -> `n8n-nodes-deluge`.

## Operations
- Get Torrents, Get Config

## Credentials
Configure the base URL and authentication in the **Deluge API** credential.

## Usage example

List torrents:

1. Add the node after a trigger (e.g. *When clicking 'Test workflow'*).
2. Select your credential.
3. **Get Torrents**.
4. Execute the node — example output:

```json
{ "hash": "a1b2...", "name": "ubuntu-24.04.iso", "state": "Seeding", "progress": 100 }
```

## Disclaimer
Not affiliated with or endorsed by the respective project.
