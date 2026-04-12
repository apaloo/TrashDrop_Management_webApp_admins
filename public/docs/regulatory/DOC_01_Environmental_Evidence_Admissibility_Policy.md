# TrashDrop — Regulatory Policy & Legal Documentation Suite
## DOC 01 · Regulatory Instrument

# Environmental Evidence Admissibility Policy

**Version 3.1**  
**Effective: March 2026**  
**Review: March 2027**  
**Authority: TrashDrop Compliance Office**

---

## 1.1 Purpose and Scope

This Policy establishes the procedures, standards, and controls governing the collection, preservation, storage, chain of custody, and potential admissibility of environmental evidence submitted through the TrashDrop platform ("Platform").

The objective is to ensure that all data and media collected maintain the highest practicable standards of integrity, authenticity, and reliability, such that environmental incident reports may credibly support:

- Municipal environmental enforcement actions by designated authorities
- Regulatory compliance monitoring by national and sub-national agencies
- Civil and administrative proceedings where relevant
- Evidence-based environmental policy formulation
- Reporting obligations to development finance institutions and bilateral partners

⚖️ **Drafted in conformity with** the Environmental Protection Agency Act, 1994 (Act 490), the Public Health Act, 2012 (Act 851), the Local Governance Act, 2016 (Act 936), and the Evidence Act, 1975 (NRCD 323) of the Republic of Ghana. Where TrashDrop operates in other ECOWAS member states, provisions of applicable national legislation shall additionally apply.

---

## 1.2 Categories of Evidence Collected

| Category | Description | Classification |
|----------|-------------|----------------|
| Photographic documentation | Georeferenced still images of illegal dumping or environmental violations | Primary Evidence |
| Geolocation data | GPS coordinates captured at time of submission (latitude/longitude, ±5m accuracy) | Primary Evidence |
| Timestamp records | UTC-synchronised date and time of report creation and file upload | Primary Evidence |
| Video documentation | Short-form video evidence where enabled by platform configuration | Primary Evidence |
| User narrative | Textual description of the incident as supplied by the reporting user | Supporting Evidence |
| System audit log | Immutable record of all actions taken on a report from submission to resolution | Chain of Custody |
| Device metadata | Device type, OS version, and application version at time of submission | Technical Corroboration |

---

## 1.3 Evidence Integrity Standards

1. **Immutable timestamping.** All reports receive a server-generated UTC timestamp upon submission. Client-side timestamps are separately recorded to permit discrepancy detection.

2. **Cryptographic hashing.** Each media file is assigned a SHA-256 hash upon ingestion. Any alteration is detectable by system audit.

3. **GPS capture at submission.** Coordinates are embedded in file EXIF metadata and independently captured at the moment of submission.

4. **Original file preservation.** Original uploaded media files are archived unmodified. Derivative copies are clearly distinguished.

5. **Encrypted storage.** All evidence data is encrypted using AES-256 at rest and TLS 1.3 in transit.

6. **Access logging.** Every access to stored reports is logged with timestamp, user identity, and action type.

7. **NTP clock synchronisation.** Servers synchronise with authenticated time sources to prevent timestamp manipulation.

---

## 1.4 Chain of Custody

A continuous and verifiable chain of custody is maintained for all environmental reports from initial submission through to archival or disposition. Each report is assigned a unique Report Reference Number (RRN) in the format:

```
TDR-[YYYY]-[MM]-[XXXXXXXX]
```

This identifier is immutable and persists throughout the report lifecycle. The system automatically records: report submission time; reporting user ID; file upload metadata; and all subsequent administrative actions.

### Custody Integrity Assurance

Custody log entries are append-only and cryptographically linked (chained). Retroactive modification of any log entry is technically prevented and produces a detectable integrity fault.

---

## 1.5 Verification and Field Confirmation

Authorised municipal environmental officers may verify reports through the following processes:

- Field inspection with results recorded in the Platform
- Photographic confirmation submitted via the municipal dashboard
- Comparison with prior reports for the same location
- Community validation through corroborating reports from independent users

Verification actions are appended as administrative notes and do not overwrite or alter the original evidence submission. All entries are attributed to the verifying officer's unique identity and timestamped.

---

## 1.6 Permissible Use of Evidence

- Initiation or support of municipal and national environmental enforcement proceedings
- Environmental and public health monitoring and reporting
- Strategic waste management planning by competent authorities
- Public health interventions by metropolitan and district assemblies
- Reporting to environmental regulators and development partners
- Judicial or administrative proceedings where lawfully required

⚠️ **Important Limitation**

TrashDrop does not independently initiate, direct, or conduct environmental enforcement actions. The Platform serves exclusively as data collection and reporting infrastructure. All enforcement authority remains vested in relevant governmental bodies, including the Environmental Protection Agency and competent local authorities.

---

## 1.7 Data Retention Schedule

| Record Type | Active Retention | Archival Period | Basis |
|-------------|------------------|-----------------|-------|
| Unresolved incident reports | Until resolution + 6 months | 5 years | Municipal enforcement timeline |
| Resolved incident reports | 24 months | 5 years | Regulatory reference |
| Custody log entries | Permanent | Permanent | Evidence integrity |
| Media files (images/video) | 24 months active | 5 years encrypted archive | Enforcement proceedings |
| Audit logs | 36 months active | 7 years | Security & legal compliance |

---

**TrashDrop Compliance Office**  
*Environmental Evidence Admissibility Policy v3.1*
