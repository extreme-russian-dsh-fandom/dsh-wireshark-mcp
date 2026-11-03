# Wireshark MCP for DeepSeek Harness

DeepSeek Harness bundle that connects the [Wireshark MCP](https://github.com/bx33661/Wireshark-MCP)
server over stdio. The agent gets the server's tools as `mcp__wireshark__*`, for example
`mcp__wireshark__quick_analysis` or `mcp__wireshark__detect_dns_tunnel`.

```text
Analyze capture.pcap: call mcp__wireshark__open_file, then mcp__wireshark__quick_analysis.
```

## How it works

`cordis.patch.yml` inserts one `@deepseek-ai/dsh-mcp-client` row. That row runs:

```text
uvx --from wireshark-mcp wireshark-mcp serve --profile analysis
```

`uvx` runs the pinned PyPI package `wireshark-mcp` in an isolated cache, so no global Python
install is needed. First start downloads the package; later starts reuse the cache.

## Prerequisites

| Need | Why |
|---|---|
| [Wireshark](https://www.wireshark.org/) installed | Every analysis tool shells out to `tshark`. Without it the server connects but analysis calls fail. On Windows the bundle adds `%ProgramFiles%\Wireshark` to the child `PATH`, because the installer often leaves it out. |
| [uv](https://docs.astral.sh/uv/) (`uvx` on `PATH`) | Launches the server. |
| Network on first start | `uvx` fetches `wireshark-mcp` from PyPI once. |

Optional Wireshark suite binaries enable extra tools when present: `capinfos`, `mergecap`,
`editcap`, `dumpcap`, `text2pcap`.

## Tools

The `analysis` profile advertises 42 tools: packet list/details/bytes/stream, field and object
extraction, aggregates, protocol hierarchy, endpoints, conversations, I/O graph, expert info,
credential scan, port scan, DNS tunnel, DoS, beaconing, exfiltration, protocol anomalies, YARA,
`analyze_protocol` (25 protocols), TCP health, ARP spoofing, decryption and dissection overrides,
TLS fingerprints, GeoIP, and case files.

Profiles, chosen in `cordis.patch.yml`:

| Profile | Tools | Difference |
|---|---|---|
| `analysis` (default here) | 42 | No live capture, no caller-directed file writes. |
| `full` | 54 | Adds live capture, interface listing, merge/editcap/filter-save/text2pcap. |
| `core` | 34 | Smallest prompt cost. |

Lower prompt cost matters: the tool list is sent with every request.

## Configuration

Edit the inserted row, then reload. Fields honored by this bundle:

- `command` — defaults to `WIRESHARK_MCP_COMMAND`, else `uvx`. Set an absolute path when the
  Harness process does not see `uvx` on `PATH`.
- `args` — append `--profile full` to switch profiles, or `--profile core` to shrink the surface.
- `toolCallTimeoutMs` — 180000 ms here; the upstream default of 60 s is short for 1 GB captures.

Environment for the child process goes in the same row under `env:`; note the MCP client drops
ambient names matching `KEY|PASSWORD|SECRET|TOKEN` and every `DSH_*` name, so pass those explicitly.

Upstream settings this bundle does not preselect:

- `WIRESHARK_MCP_MAX_RESULT_CHARS` — result ceiling, default 8000.
- `WIRESHARK_MCP_ALLOWED_DIRS` — required by the file-writing tools, which fail closed until it
  names existing directories. Needed only with `--profile full`.

## Verify a build

`probe/` holds the checks used for this bundle; none of it ships with the plugin.

```sh
python probe/make_pcap.py probe/sample.pcap   # 2 DNS queries + 1 TCP SYN
node probe/mcp-probe.mjs                     # raw stdio handshake, expects 54 tools on full
```

In a Harness session, `mcp__wireshark__get_capabilities` must report `tshark.available: true`,
and `mcp__wireshark__quick_analysis` on `probe/sample.pcap` must return the protocol hierarchy.

## Safety notes

- Analysis tools read captures only. Live capture and file-writing tools are absent from the
  default `analysis` profile.
- The server runs locally over stdio. No port is opened.

## Uninstall

Remove the bundle from the Harness plugin manager. Nothing else is written outside the `uvx` cache.
