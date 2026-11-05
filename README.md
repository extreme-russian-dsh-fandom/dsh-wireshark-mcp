# dsh-wireshark-mcp

**English** · [Русский](README.ru.md)

DeepSeek Harness adapter for [bx33661/Wireshark-MCP](https://github.com/bx33661/Wireshark-MCP).

One command connects the upstream MCP server to DSH, so the model gets its tools as
`mcp__wireshark__*` — `wireshark_open_file`, `wireshark_quick_analysis`, `wireshark_aggregate`,
`wireshark_follow_stream`, `wireshark_detect_dns_tunnel` and so on.

> This is **not** a fork of Wireshark-MCP and contains none of its code. It ships one
> `cordis.patch.yml` that wires the upstream server, installed from PyPI by `uvx`.

## Install

Current source — use this one; it is where future changes and fixes land:

```bash
dsh plugin --profile desktop add "github:extreme-russian-dsh-fandom/dsh-wireshark-mcp#master"
```

Repository: <https://github.com/extreme-russian-dsh-fandom/dsh-wireshark-mcp>.

Legacy source (GitLab):

```bash
dsh plugin --profile desktop add "gitlab:andrey23525/deepseek-wireshark-mcp#master"
```

Repository: <https://gitlab.com/andrey23525/deepseek-wireshark-mcp>.

> **NOTE (05-11-2026):** the two repositories carry the same code today. The GitLab one is the
> older location — it is not updated anymore and may fall behind, so the GitHub spec above takes
> precedence whenever both are listed.

Restart the Harness. The model sees `mcp__wireshark__*` tools.

Without the CLI, use the Harness Web **Plugins** page and install either spec. For development,
install the checkout directory instead:

```text
C:\Work\dsh-wireshark-mcp
```

Installing a local directory links it, so later edits need only a bundle re-enable. Installing the
git spec copies the package: push first, then reinstall to pick up changes.

## Prerequisites

| Need | Why |
|---|---|
| [Wireshark](https://www.wireshark.org/) installed | Every analysis tool shells out to `tshark`. On Windows the bundle adds `%ProgramFiles%\Wireshark` to the child `PATH`, because the installer often leaves it out. |
| [uv](https://docs.astral.sh/uv/) (`uvx` on `PATH`) | Launches the server. Override with `WIRESHARK_MCP_COMMAND` when it lives elsewhere. |
| Network on first start | `uvx` fetches `wireshark-mcp` from PyPI once, then reuses its cache. |

Optional Wireshark suite binaries enable extra tools when present: `capinfos`, `mergecap`,
`editcap`, `dumpcap`, `text2pcap`.

## Usage

```text
Analyze C:\captures\capture.pcap: call mcp__wireshark__open_file, then mcp__wireshark__quick_analysis.
Index big.pcapng with mcp__wireshark__index, then count destinations with mcp__wireshark__aggregate.
```

## Tools and profiles

The `analysis` profile advertises 42 tools: packet list/details/bytes/stream, field and object
extraction, aggregates, protocol hierarchy, endpoints, conversations, I/O graph, expert info,
credential scan, port scan, DNS tunnel, DoS, beaconing, exfiltration, protocol anomalies, YARA,
`analyze_protocol` (25 protocols), TCP health, ARP spoofing, decryption and dissection overrides,
TLS fingerprints, GeoIP, and case files.

| Profile | Tools | Difference |
|---|---|---|
| `analysis` (default) | 42 | No live capture, no caller-directed file writes. |
| `full` | 54 | Adds live capture, interface listing, merge/editcap/filter-save/text2pcap, file writes. |
| `core` | 34 | Smallest prompt cost. |

The tool list travels with every request, so a smaller profile costs less.

Switching needs no YAML edit:

```powershell
$env:WIRESHARK_MCP_PROFILE = 'full'
$env:WIRESHARK_MCP_ALLOWED_DIRS = 'C:\captures'
```

Restart the Harness afterwards, since the server process is spawned once at startup.

## Configuration

Environment variables read by `cordis.patch.yml`:

| Variable | Default | Meaning |
|---|---|---|
| `WIRESHARK_MCP_COMMAND` | `uvx` | Executable that starts the server. |
| `WIRESHARK_MCP_PROFILE` | `analysis` | `analysis`, `full`, or `core`. |
| `WIRESHARK_MCP_ALLOWED_DIRS` | empty | Allowlist for the file-writing tools. Empty blocks them, which is upstream's fail-closed default. |
| `WIRESHARK_MCP_MAX_RESULT_CHARS` | `8000` | Per-result ceiling. |
| `WIRESHARK_MCP_TIMEOUT_MS` | `180000` | Per-call timeout; upstream defaults to 60 s. |

The MCP client scrubs ambient names matching `KEY|PASSWORD|SECRET|TOKEN` and every `DSH_*` name,
so pass anything the server needs explicitly. To pin the row instead, override it in the profile's
`cordis.patch.yml` — same id, last writer wins:

```yaml
- insert:
    - id: wireshark-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: wireshark
        transport: stdio
        command: 'C:\Users\<you>\AppData\Local\Programs\Python\Python312\Scripts\uvx.exe'
        args: ['--from', 'wireshark-mcp', 'wireshark-mcp', 'serve', '--profile', 'full']
        env:
          WIRESHARK_MCP_ALLOWED_DIRS: 'C:\captures'
        toolCallTimeoutMs: 300000
```

## Verify a build

`probe/` holds the checks used for this bundle; none of it ships with the plugin.

```sh
python probe/make_pcap.py probe/sample.pcap   # 2 DNS queries + 1 TCP SYN
node probe/mcp-probe.mjs                     # raw stdio handshake, expects 54 tools on full
node probe/mcp-probe-full.mjs                # full profile with the empty allowlist
```

In a Harness session, `mcp__wireshark__get_capabilities` must report `tshark.available: true`,
and `mcp__wireshark__quick_analysis` on `probe/sample.pcap` must return the protocol hierarchy.

## Safety notes

- Analysis tools read captures only. The default profile omits live capture and file writes.
- The server runs locally over stdio. No port is opened.
- The server can run `dumpcap` with the host user's permissions when `full` is enabled.

## Uninstall

Remove the bundle in the Harness Plugins page, or:

```bash
dsh plugin --profile desktop remove dsh-wireshark-mcp
```

Nothing else is written outside the `uvx` cache.

## Attribution / License

- Upstream server: [bx33661/Wireshark-MCP](https://github.com/bx33661/Wireshark-MCP), MIT.
- This adapter: MIT, wiring and documentation only, no upstream code. See [LICENSE](LICENSE).
