# TrashDrop — Regulatory Policy & Legal Documentation Suite
## DOC 02 · DPIA

# Data Protection Impact Assessment

**Version 3.1**  
**Effective: March 2026**  
**Conducted by: TrashDrop DPO**  
**Act 843 · ECOWAS · Malabo**

---

## DPO Declaration

This DPIA has been conducted under the supervision of the TrashDrop Data Protection Officer pursuant to Section 33, Data Protection Act 2012 (Act 843). A copy is available to the Data Protection Commission of Ghana upon request.

---

## 2.1 Overview and Legal Basis

This Data Protection Impact Assessment ("DPIA") is conducted pursuant to the Data Protection Act, 2012 (Act 843) of Ghana, the ECOWAS Supplementary Act A/SA.1/01/10 on Personal Data Protection, and the African Union Convention on Cyber Security and Personal Data Protection (Malabo Convention, 2014).

A DPIA is required because TrashDrop processes personal data at scale — including location data, photographic media, and individual identity information — in connection with a civic-technology service deployed to public authorities.

---

## 2.2 Processing Activities

| Processing Activity | Purpose | Legal Basis (Act 843) |
|---------------------|---------|----------------------|
| User account registration | Platform access control; report attribution | Consent / Contract |
| Environmental incident reporting | Georeferenced reports to municipal authorities | Public interest / Legitimate interest |
| Geolocation processing | Precise incident location capture | Public interest / Consent |
| Media upload and storage | Photographic/video evidence preservation | Public interest / Legitimate interest |
| Municipal analytics dashboards | Aggregated reporting to authorities | Public interest / Legitimate interest |
| Access and audit logging | Security monitoring; chain of custody | Legal obligation / Legitimate interest |
| Push notifications | Report status updates to submitting user | Consent |

---

## 2.3 Categories of Personal Data

### Standard Personal Data
- Full name and contact details (email address, phone number)
- Account credentials (stored in hashed form — bcrypt min. cost factor 12)
- User role and organisational affiliation where applicable
- Device identifiers (device ID, operating system)
- System access logs (login times, actions performed)

### Special-Category / Sensitive Data
- Precise geolocation data — captured at time of incident reporting, linked to user identity
- Photographic media — images or video which may incidentally capture identifiable individuals, vehicle registration plates, or private property
- Behavioural and usage data — patterns that may in aggregate reveal sensitive information about location habits

---

## 2.4 Risk Assessment Matrix

| Risk Category | Likelihood | Severity | Residual Risk |
|---------------|------------|----------|---------------|
| Incidental Capture of Individuals | High | Moderate | Low–Medium |
| Geolocation Sensitivity | Medium | Moderate | Low |
| Unauthorised Platform Access | Low (post-control) | High | Low |
| Data Misuse by Officers | Low | Moderate | Low |
| Data Breach / Exfiltration | Low (post-control) | High | Low–Medium |
| Function Creep | Low | Medium | Low |

---

## 2.5 Mitigation Measures

### Technical Safeguards
- Role-based access control (RBAC) — principle of least privilege across all system tiers
- End-to-end encryption — TLS 1.3 in transit, AES-256 at rest
- ISO 27001-certified cloud infrastructure with SOC 2 Type II certification
- Multi-factor authentication (MFA) mandatory for all officer and admin accounts
- Automated real-time anomaly detection and SIEM alerting
- Pseudonymisation of personal identifiers in analytics outputs where feasible
- Automatic session timeouts across all platform access points

### Organisational Safeguards
- Qualified DPO registered with the Data Protection Commission of Ghana
- Data processing agreements (DPAs) executed with all third-party processors
- Annual data protection and security training for all staff and officers
- Documented breach response procedure with mandatory notification timelines
- Privacy-by-design embedded in all development and release processes
- Annual independent penetration testing by a qualified third-party firm

---

## 2.6 Data Subject Rights

TrashDrop recognises and upholds the rights of data subjects under Act 843, including:

- Right of access
- Right of rectification
- Right of erasure (subject to evidence retention obligations)
- Right to object
- Right to data portability
- Right not to be subject to solely automated consequential decisions

**Requests to exercise these rights:** privacy@trashdrops.com — responded to within 30 calendar days.

---

## 2.7 Residual Risk Evaluation

Following implementation of the mitigation measures described in Section 2.5, the residual risk level for all identified risk categories is assessed as low to moderate — acceptable for the environmental monitoring and civic engagement purposes for which the Platform is designed. This DPIA is subject to annual review.

---

**Data Protection Officer, TrashDrop**  
Name: ___________________________  
Date: ___________________________

**Head of Legal & Compliance, TrashDrop**  
Name: ___________________________  
Date: ___________________________
