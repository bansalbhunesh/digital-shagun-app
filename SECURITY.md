# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please do not disclose it publicly. Instead, report it to the maintainers through one of the following methods:

- **Email**: bhuneshbansal20039888@gmail.com
- **GitHub Issues**: Please use the "Private Vulnerability Reporting" feature if available on this repository.

Please include the following details in your report:

- A description of the vulnerability.
- Steps to reproduce the issue.
- Potential impact of the vulnerability.

We aim to acknowledge all reports within 48 hours and provide a fix or mitigation plan within a reasonable timeframe.

## Security Best Practices

- **Authentication**: All sensitive API routes are protected by Supabase Auth (`requireAuth`).
- **Authorization**: Identities are inferred from tokens; never trust identity fields passed in request bodies.
- **Data Protection**: Sensitive financial data (shagun amounts) is only revealed after a set delay.
- **Dependency Management**: We use `pnpm` with `--frozen-lockfile` in CI to ensure reproducible and safe builds.
- **Rate Limiting**: API endpoints are protected by `express-rate-limit` to prevent brute-force and DoS attacks.
- **CORS Policy**: Configured via `cors` middleware, strictly allowing only authorized origins in production.
- **Input Sanitization**: All user-provided strings are sanitized at the middleware level to prevent XSS and injection attacks.
- **Security Headers**: `helmet` is used to set secure HTTP headers.
