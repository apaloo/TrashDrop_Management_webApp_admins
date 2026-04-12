# TrashDrop — Regulatory Policy & Legal Documentation Suite
## DOC 08 · Technical Security Policy

# Information Security Policy

**Version 3.1**  
**Effective: March 2026**  
**ISO/IEC 27001:2022 Aligned**

---

## 8.1 Purpose and Scope

This Information Security Policy ("Policy") establishes the principles, controls, and procedures governing the security of TrashDrop's information assets, technology infrastructure, and all personal and environmental data entrusted to the Platform. The Policy is aligned with ISO/IEC 27001:2022 and the technical requirements of Act 843.

| Standard | Value |
|----------|-------|
| AES-256 | Encryption Standard (At Rest) |
| TLS 1.3 | Encryption Standard (In Transit) |
| 72 hrs | Max Breach Notification SLA |

---

## 8.2 Encryption Standards

| Data State | Standard | Scope |
|------------|----------|-------|
| Data in transit | TLS 1.3 (min. TLS 1.2) | All API calls, web traffic, mobile app communications |
| Data at rest | AES-256 | All databases, file storage, backups |
| Media files | AES-256 + envelope encryption | All uploaded photographic and video evidence |
| Passwords / credentials | bcrypt (min. cost factor 12) | All user password storage |
| API tokens | HMAC-SHA256 signed JWTs | All platform API authentication |
| Backups | AES-256 + offline key storage | All automated and manual backups |

---

## 8.3 Access Control

- **Principle of least privilege:** All access is limited to the minimum required for the user's role
- **RBAC:** Five defined tiers: End User, Municipal Officer, Municipal Admin, TrashDrop Support, TrashDrop Admin
- **MFA:** Mandatory for all Municipal Officer, Municipal Admin, and TrashDrop staff accounts
- **Quarterly access reviews:** Stale or unused accounts are disabled
- **Privileged access management:** Admin credentials subject to session recording and just-in-time provisioning

---

## 8.4 Infrastructure Security

- ISO 27001-certified cloud infrastructure with SOC 2 Type II certification
- Strict segregation of production, staging, and development environments
- Automated IDS/IPS across all production infrastructure
- Automated dependency scanning on every code deployment — critical vulnerabilities remediated within 72 hours
- Web application firewall (WAF) and DDoS mitigation services in place

---

## 8.5 Backup and Recovery

- Automated encrypted database backups performed daily with point-in-time recovery capability
- Backups stored in a geographically separate facility from primary data
- Recovery Time Objective (RTO): 4 hours; Recovery Point Objective (RPO): 1 hour
- Backup restoration tested at least quarterly

---

## 8.6 Data Breach Response

TrashDrop maintains and rehearses a documented Data Breach Response Plan. In the event of a confirmed or suspected breach:

1. **Containment** — immediate isolation of affected systems (within 1 hour)
2. **Assessment** — scope, nature, and data categories affected (within 24 hours)
3. **Notification** — Data Protection Commission within 72 hours where required; municipal partners within 48 hours; affected data subjects without undue delay
4. **Remediation** — root cause identified and technical fix deployed
5. **Post-incident review** — documented root cause analysis within 30 days

---

## 8.7 Personnel Security

- All staff with access to personal data undergo background verification on appointment
- Data protection and security training mandatory on onboarding and annually thereafter
- Access revoked within 4 hours of employment termination
- Confidentiality obligations survive employment for 5 years

---

## 8.8 Vulnerability Disclosure

TrashDrop operates a responsible vulnerability disclosure programme. Security researchers who identify vulnerabilities are invited to report them to security@trashdrops.com. We will acknowledge receipt within 48 hours and work collaboratively to remediate confirmed issues. We will not take legal action against researchers acting in good faith.

---

## ISO/IEC 27001:2022 Commitment

TrashDrop is committed to achieving and maintaining ISO/IEC 27001:2022 certification. Our entire security programme is assessed against the ISO 27001 control framework as the baseline standard for all security activities.

+
