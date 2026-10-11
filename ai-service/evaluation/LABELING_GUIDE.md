# FeedbackIQ AI Dataset Annotation Guidelines

> [!IMPORTANT]
> **STATUS: DRAFT LABELS**
> Before executing evaluation scripts (`evaluate.py`), you must review and verify every row in `dataset_dev.csv` and `dataset_test.csv` to ensure ground-truth accuracy. Incorrect ground-truth annotations invalidate evaluation metrics.

---

## 1. Category Classification Guidelines

Each item must be assigned exactly **one** primary category:

1. **`security`**: Vulnerabilities, data leaks, hacked accounts, authorization bypasses, exposed passwords, security compliance, cookie theft, unencrypted sensitive data.
2. **`bug`**: System errors, crashes, broken functionality, unexpected behavior, failed payments, blank screens, incorrect calculation results, application exceptions.
3. **`performance`**: Slow loading times, high CPU/RAM usage, browser freezing/hanging, timeout errors during upload/export, laggy user interface response.
4. **`feature_request`**: Requests for new features, integrations, export formats, additional settings, new workflows, expanded functionality.
5. **`ui_ux`**: Visual design, dark mode complaints, font sizes, contrast issues, layout misalignment, hard-to-find buttons, navigation confusion, mobile responsiveness aesthetics.
6. **`other`**: General compliments, neutral statements, unclassified feedback, off-topic notes, thank-you messages.

---

## 2. Priority Rating Guidelines

Priority represents business urgency and operational impact:

- **`critical`**: Complete system outages, active security breaches, data loss, payment double charges, accounts hacked, production database leaks, total unusability for all users.
- **`high`**: Major feature crashes, broken checkout, persistent upload failures, authentication failures, blocking issues without workarounds.
- **`medium`**: Minor bugs with workarounds, noticeable performance slowdowns, UI defects affecting usability, important feature requests with high impact.
- **`low`**: Minor typos, cosmetic visual tweaks, general compliments, low-impact feature suggestions.

---

## 3. Handling Mixed Signals & Edge Cases

- **Mixed Sentiment (e.g. Compliment + Bug)**: Prioritize the operational issue (`bug` or `security`) over general praise.
- **Polite Bug / Security Reports**: Do not lower priority just because the wording is polite. Focus on severity and impact.
- **Urgency Words ("ASAP", "Immediately", "Blocker")**: Elevate priority by one level if operational functionality is impaired.
