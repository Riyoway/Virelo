# Security

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for the `Riyoway/virelo` repository and include the affected version, reproduction steps, and expected impact.

## Network exposure

Virelo binds to `127.0.0.1` by default. Binding to `0.0.0.0` makes the service reachable from other devices, but Virelo does not include application-level authentication. Use only a trusted LAN or an authenticated reverse proxy.

Do not expose the Virelo HTTP port directly to the public internet.

## HTTP protections

Virelo validates `Host` and `Origin` headers and sends a restrictive Content Security Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a same-origin resource policy, and a no-referrer policy.

Loopback, private IPv4 ranges, link-local and private IPv6 ranges, `.local` names, and single-label LAN hostnames are accepted. A reverse proxy using another hostname must explicitly allow it:

```bash
VIRELO_TRUSTED_HOSTS=media.example.com virelo --host 0.0.0.0
```

This allowlist does not provide authentication.
