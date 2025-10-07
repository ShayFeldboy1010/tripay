# Codex Audit

Generated: 2025-10-07T05:35:28.026Z

## Summary

| Category | Findings |
| --- | --- |
| duplicateProviders | 0 |
| envConflicts | 0 |
| legacyEndpoints | 0 |
| unsafeFetches | 0 |
| missingPreventDefault | 0 |
| overlays | 8 |
| pointerEventsNone | 6 |

## Findings

### duplicateProviders
- _No findings_

### envConflicts
- _No findings_

### legacyEndpoints
- _No findings_

### unsafeFetches
- _No findings_

### missingPreventDefault
- _No findings_

### overlays
- (low) **components/add-expense-form.tsx:140** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.
- (low) **components/edit-expense-form.tsx:130** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.
- (low) **components/manage-locations-modal.tsx:81** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.
- (low) **components/fab.tsx:40** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.
- (low) **components/manage-participants-modal.tsx:81** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.
- (low) **components/ui/dropdown-menu.tsx:45** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.
- (low) **components/ui/select.tsx:64** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.
- (low) **app/trip/[id]/page.tsx:447** — High z-index detected. _Suggestion:_ Confirm overlay layering does not block chat interactions.

### pointerEventsNone
- (low) **components/ui/badge.tsx:8** — Found pointer-events-none class. _Suggestion:_ Ensure this class does not block interactive controls.
- (low) **components/ui/button.tsx:8** — Found pointer-events-none class. _Suggestion:_ Ensure this class does not block interactive controls.
- (low) **components/ui/dropdown-menu.tsx:77** — Found pointer-events-none class. _Suggestion:_ Ensure this class does not block interactive controls.
- (low) **components/ui/select.tsx:40** — Found pointer-events-none class. _Suggestion:_ Ensure this class does not block interactive controls.
- (low) **components/ui/tabs.tsx:45** — Found pointer-events-none class. _Suggestion:_ Ensure this class does not block interactive controls.
- (low) **components/ui/input.tsx:12** — Found pointer-events-none class. _Suggestion:_ Ensure this class does not block interactive controls.

## Prioritized Checklist

[x] duplicate Providers
[x] env Conflicts
[x] legacy Endpoints
[x] unsafe Fetches
[x] missing Prevent Default
[ ] overlays
[ ] pointer Events None
