const fs = require('fs');
let lines = fs.readFileSync('src/pages/GraduateStudent/StudentResearchGroups.tsx', 'utf8').split('\n');
let modified = false;

// STEP 1: Add PhaseReportDetailModal import
let importIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/import type \{ SubmittedPhasedReport \}/)) {
    importIdx = i;
    break;
  }
}
if (importIdx >= 0) {
  lines.splice(importIdx + 1, 0, "import { PhaseReportDetailModal } from '../../components/gradstudent/PhaseReportDetailModal';");
  modified = true;
  console.log('Added import at line', importIdx);
}

// After import, all subsequent line numbers are offset by 1
let offset = modified ? 1 : 0;

// STEP 2: Add state inside WorkspaceView function (after "const copy = ...")
let stateInsertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/const copy = \(en: string, vi: string\)/)) {
    stateInsertIdx = i + 1;
    break;
  }
}
if (stateInsertIdx >= 0) {
  lines.splice(stateInsertIdx, 0, '', '  // Bug fix (Sep 2026): View evaluation modal state', '  const [detailReportId, setDetailReportId] = useState<number | null>(null);', '');
  console.log('Added state at line', stateInsertIdx);
  offset += 4;
}

// STEP 3: Add detailReport derivation (before "const latestRejected")
let deriveInsertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/const latestRejected = useMemo/)) {
    deriveInsertIdx = i;
    break;
  }
}
if (deriveInsertIdx >= 0) {
  lines.splice(deriveInsertIdx, 0, '  // Derive the report being shown in the detail modal (null-safe).', '  const detailReport = detailReportId != null ? reports.find((r) => r.id === detailReportId) ?? null : null;', '');
  console.log('Added detailReport at line', deriveInsertIdx);
  offset += 3;
}

// STEP 4: Add View evaluation button (after the "paused. */}" comment in the table)
let buttonInsertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('paused. */}') && lines[i+1] && lines[i+1].includes('</div>') && lines[i+2] && lines[i+2].includes('</td>')) {
    buttonInsertIdx = i + 3; // Insert after </td>
    break;
  }
}
if (buttonInsertIdx >= 0) {
  const buttonCode = [
    '                            {/* Bug fix (Sep 2026): View evaluation button */}',
    '                            {(report as any).lectureFeedback !== undefined || (report as any).lecturerDescription || (report as any).finalOutcomeEvaluation || (report as any).capacityEvaluation ? (',
    '                              <button type="button" className={styles.detailBtn} onClick={() => setDetailReportId((report as any).id)}>',
    '                                <FileText size={12} aria-hidden />',
    "                                {copy('View evaluation', 'Xem đánh giá')}",
    '                              </button>',
    '                            ) : null}'
  ];
  lines.splice(buttonInsertIdx, 0, ...buttonCode);
  console.log('Added button at line', buttonInsertIdx);
}

// STEP 5: Add PhaseReportDetailModal (before the closing </div> of the page)
let modalInsertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  // Look for </section> followed by </div> followed by );
  if (lines[i].trim() === '</section>' && lines[i+1] && lines[i+1].trim() === '</div>' && lines[i+2] && lines[i+2].trim() === ');') {
    modalInsertIdx = i + 2; // Insert after </section>, before </div>
    break;
  }
}
if (modalInsertIdx >= 0) {
  const modalCode = [
    '',
    '      {/* Bug fix (Sep 2026): PhaseReportDetailModal for evaluated/rejected reports */}',
    '      {detailReport ? (',
    '        <PhaseReportDetailModal',
    '          isOpen={true}',
    '          report={detailReport}',
    '          groupName={group.name}',
    '          lecturerName={lecturerName}',
    '          onClose={() => setDetailReportId(null)}',
    '        />',
    '      ) : null}',
    ''
  ];
  lines.splice(modalInsertIdx, 0, ...modalCode);
  console.log('Added modal at line', modalInsertIdx);
}

fs.writeFileSync('src/pages/GraduateStudent/StudentResearchGroups.tsx', lines.join('\n'), 'utf8');
console.log('All modifications applied');
