"""Generate a tiny synthetic pcap so the Wireshark MCP bridge can be tested end to end."""
import socket
import struct
import sys


def csum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    total = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    total = (total >> 16) + (total & 0xFFFF)
    total += total >> 16
    return (~total) & 0xFFFF


def dns_query(name: str) -> bytes:
    tid = 0x1234
    header = struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    qname = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    return header + qname + struct.pack("!HH", 1, 1)


def udp_ipv4(src, dst, sport, dport, payload: bytes) -> bytes:
    udp = struct.pack("!HHHH", sport, dport, 8 + len(payload), 0) + payload
    src_b, dst_b = socket.inet_aton(src), socket.inet_aton(dst)
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(udp), 1, 0, 64, 17, 0, src_b, dst_b)
    ip = ip[:10] + struct.pack("!H", csum(ip)) + ip[12:]
    return ip + udp


def tcp_ipv4(src, dst, sport, dport) -> bytes:
    tcp = struct.pack("!HHIIBBHHH", sport, dport, 1, 0, 5 << 4, 0x02, 64240, 0, 0)
    src_b, dst_b = socket.inet_aton(src), socket.inet_aton(dst)
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(tcp), 2, 0, 64, 6, 0, src_b, dst_b)
    ip = ip[:10] + struct.pack("!H", csum(ip)) + ip[12:]
    return ip + tcp


def ether(payload: bytes) -> bytes:
    return bytes.fromhex("020000000001") + bytes.fromhex("020000000002") + b"\x08\x00" + payload


def main(path: str) -> None:
    frames = [
        ether(udp_ipv4("10.0.0.5", "10.0.0.1", 51000, 53, dns_query("example.com"))),
        ether(udp_ipv4("10.0.0.5", "10.0.0.1", 51001, 53, dns_query("a" * 60 + ".tunnel.example"))),
        ether(tcp_ipv4("10.0.0.5", "93.184.216.34", 51002, 80)),
    ]
    with open(path, "wb") as fh:
        fh.write(struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1))
        for index, frame in enumerate(frames):
            fh.write(struct.pack("<IIII", 1700000000 + index, 0, len(frame), len(frame)))
            fh.write(frame)
    print("wrote", path, len(frames), "packets")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "probe/sample.pcap")
