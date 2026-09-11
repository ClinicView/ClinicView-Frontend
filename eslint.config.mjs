import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Next 16 adds React Compiler diagnostics; the compiler is not enabled here.
  // Keep the existing migration baseline visible without changing clinical flows
  // in the security patch. All other files/rules retain the upstream severity.
  // Remove each exception as it is reviewed; see docs/DEPENDENCY-SECURITY.md.
  {
    name: "clinicview/migration-react-effects",
    files: [
      "src/app/(private)/admin/users/new/new-user-view.tsx",
      "src/app/(private)/admin/users/[[]id[]]/edit/edit-user-view.tsx",
      "src/app/(private)/patients/new/new-patient-view.tsx",
      "src/app/(private)/patients/[[]id[]]/patient-view.tsx",
      "src/app/(private)/patients/[[]id[]]/records/new/new-record-view.tsx",
      "src/app/(private)/patients/[[]id[]]/records/new/record-form-dialogs.tsx",
      "src/features/admin/hooks/use-admin-users.ts",
      "src/features/audit/hooks/use-audit-events.ts",
      "src/features/clinical-records/components/document-publication-panel.tsx",
      "src/features/clinical-records/components/record-attachments-gallery.tsx",
      "src/features/clinical-records/components/record-form.tsx",
      "src/features/clinical-records/hooks/use-record-draft.ts",
      "src/features/clinical-records/hooks/use-record.ts",
      "src/features/clinical-records/hooks/use-records.ts",
      "src/features/dashboard/hooks/use-dashboard-stats.ts",
      "src/features/global-search/components/global-search.tsx",
      "src/features/global-search/hooks/use-global-search.ts",
      "src/features/medical-documents/components/document-detail.tsx",
      "src/features/medical-documents/components/document-upload-dialog.tsx",
      "src/features/medical-documents/hooks/use-document-file.ts",
      "src/features/medical-documents/hooks/use-document.ts",
      "src/features/medical-documents/hooks/use-documents.ts",
      "src/features/notifications/hooks/use-notifications.ts",
      "src/features/patients/components/clinical-summary-panel.tsx",
      "src/features/patients/components/patient-safety-band.tsx",
      "src/features/patients/hooks/use-history-overview.ts",
      "src/features/patients/hooks/use-patient.ts",
      "src/features/patients/hooks/use-patients.ts",
      "src/features/profile/hooks/use-profile.ts",
      "src/features/review/hooks/use-review-queue.ts",
      "src/shared/components/page-shell.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  {
    name: "clinicview/migration-react-refs",
    files: [
      "src/features/clinical-records/components/record-form.tsx",
      "src/features/medical-documents/hooks/use-document-navigation-guard.ts",
      "src/features/medical-documents/hooks/use-document.ts",
    ],
    rules: { "react-hooks/refs": "warn" },
  },
  {
    name: "clinicview/migration-search-index",
    files: ["src/features/global-search/components/global-search.tsx"],
    rules: { "react-hooks/immutability": "warn" },
  },
  {
    name: "clinicview/migration-document-memoization",
    files: ["src/features/medical-documents/components/document-detail.tsx"],
    rules: { "react-hooks/preserve-manual-memoization": "warn" },
  },
]);

export default eslintConfig;
