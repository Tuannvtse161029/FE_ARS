const fs = require('fs');
let content = fs.readFileSync('src/pages/GraduateStudent/StudentResearchGroups.tsx', 'utf8');

// 1. Add import for PhaseReportDetailModal
content = content.replace(
  /import type \{ SubmittedPhasedReport \} from '\.\.\/\.\.\/services\/phasedReport\.service';/,
  "import type { SubmittedPhasedReport } from '../../services/phasedReport.service';\nimport { PhaseReportDetailModal } from '../../components/gradstudent/PhaseReportDetailModal';"
);

// 2. Add state inside WorkspaceView function
const stateMarker = "const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);";
const stateInjection = `const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);

  // Bug fix (Sep 2026): View evaluation modal state
  const [detailReportId, setDetailReportId] = useState<number | null>(null);`;
content = content.replace(stateMarker, stateInjection);

// 3. Add detailReport derivation
const detailMarker = '  const latestRejected = useMemo<SubmittedPhasedReport | null>';
const detailInjection = `  // Derive the report being shown in the detail modal (null-safe).
  const detailReport = detailReportId != null ? reports.find((r) => r.id === detailReportId) ?? null : null;

  ${detailMarker}`;
content = content.replace(detailMarker, detailInjection);

// 4. Add View evaluation button in the table
const btnMarker = 'paused. */\n                          </div>\n                        </td>';
const btnInjection = `paused. */}
                            {/* Bug fix (Sep 2026): View evaluation button */}
                            {report.lectureFeedback !== undefined || report.lecturerDescription || report.finalOutcomeEvaluation || report.capacityEvaluation ? (
                              <button type="button" className={styles.detailBtn} onClick={() => setDetailReportId(report.id)}>
                                <FileText size={12} aria-hidden />
                                {copy('View evaluation', 'Xem đánh giá')}
                              </button>
                            ) : null}
                          </div>
                        </td>`;
content = content.replace(btnMarker, btnInjection);

// 5. Add PhaseReportDetailModal at the end
const endMarker = '      </section>\n\n      </div>\n  );\n}\n\nexport default StudentResearchGroups;';
const endInjection = `      </section>

      {/* Bug fix (Sep 2026): PhaseReportDetailModal for evaluated/rejected reports */}
      {detailReport ? (
        <PhaseReportDetailModal
          isOpen={true}
          report={detailReport}
          groupName={group.name}
          lecturerName={lecturerName}
          onClose={() => setDetailReportId(null)}
        />
      ) : null}
    </div>
  );
}

export default StudentResearchGroups;`;
content = content.replace(endMarker, endInjection);

fs.writeFileSync('src/pages/GraduateStudent/StudentResearchGroups.tsx', content, 'utf8');
console.log('Modifications applied successfully');
