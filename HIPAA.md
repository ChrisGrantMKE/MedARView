# HIPAA Concern Log

This file logs privacy and HIPAA-adjacent concerns for the MedARView prototype.

Current scope:

- mock data only
- self-hosted home test environment
- existing domain already available
- actual HIPAA compliance work is intentionally waived for this phase

Even with compliance waived, the following concerns should stay visible and tracked.

## Logged Concerns

| Area | Potential concern | Why it still matters in mock testing | Current handling |
| --- | --- | --- | --- |
| Browser microphone capture | The headset microphone continuously captures spoken audio. | Real voice data can still be spoken during testing even when patient records are fake. | Restrict testing to mock scenarios and test users only. |
| Third-party transcription provider | Audio leaves the home-hosted system and is sent to Google Cloud Speech-to-Text. | Cloud processing is still an external transfer boundary. | Use mock conversations only and avoid real patient identifiers. |
| Transcript persistence | Saved transcripts may contain sensitive-looking content, even if synthetic. | Developers can accidentally copy real details into a mock test. | Store only synthetic transcripts and keep retention short. |
| Application logs | Server logs may capture transcript text, errors, or request payloads. | Logs are easy to overlook and often live longer than app data. | Avoid logging raw transcript bodies by default. |
| API credentials | Cloud provider credentials on the home server could be exposed. | Key leakage would allow misuse of the transcription account. | Keep keys server-side in environment variables only. |
| HTTPS and domain configuration | Insecure transport can expose microphone or transcript traffic in transit. | Quest/WebXR and mic permissions depend on secure contexts. | Serve the app and backend over HTTPS on the existing domain. |
| Local storage / exports | Cached browser data or exported files may retain transcripts. | Test machines often accumulate artifacts outside the main app flow. | Clear test artifacts regularly and avoid unnecessary downloads. |
| Backups | Home-server backups may include transcripts, logs, or secrets. | Old backups can outlive the test window and escape normal cleanup. | Exclude transient transcript/log directories where practical. |
| Access control | Anyone with LAN or host access may be able to open the test dashboard. | Home-hosted does not automatically mean access-controlled. | Limit access to trusted users and close unused ports. |
| Speaker labeling | Doctor/patient attribution can be wrong. | Misattribution changes how transcript text is interpreted. | Treat speaker labels as assistive output, not authoritative truth. |

## Deferred For Production

These items are intentionally deferred and should be revisited before any real-world or non-mock deployment:

- BAA and vendor contract review
- formal retention policy
- audit logging design
- access control hardening
- data deletion workflow
- PHI-safe observability and redaction
- incident response and backup handling