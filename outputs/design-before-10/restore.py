import pathlib, json, shutil, re, difflib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/design-before-10'
BASE = OUT / 'baseline'
BACK = OUT / 'before'
changed = []

def write(path, text):
    target = ROOT / path
    old = target.read_text(encoding='utf8')
    if old == text:
        return
    backup = BACK / path
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, backup)
    target.write_text(text, encoding='utf8', newline='\n')
    changed.append(path)

# Restore every existing stylesheet that differs from the 09:57 checkpoint.
# School-only additions support new academic-year and guardian controls.
for file in BASE.rglob('*.css'):
    path = file.relative_to(BASE).as_posix()
    text = file.read_text(encoding='utf8')
    current = (ROOT / path).read_text(encoding='utf8')
    if path.endswith('/school/school.css'):
        # All differences here are new controls, with the original palette intact.
        continue
    if path.endswith('/organization-workspace.css'):
        text += '\n' + '\n'.join(line for line in current.splitlines() if line.startswith('.guardian-')) + '\n'
    write(path, text)

visual_files = [
    'App.js', 'components/AppErrorBoundary.jsx', 'components/FormChartView.jsx',
    'components/PwaInstallPrompt.jsx', 'components/dashboard/SystemEvaluationWidget.jsx',
    'pages/admin/Appointment.jsx', 'pages/admin/RiskCases.jsx', 'pages/admin/dashboard.jsx',
    'pages/admin/forms/FormManager.jsx',
    'pages/admin/forms/builder-components/SortableQuestion.jsx',
    'pages/helpCenter/ClinicHelpDetail.jsx', 'pages/helpCenter/HelpCenterUser.jsx',
    'pages/patient/PatientChangePassword.jsx', 'pages/patient/PatientLogin.jsx',
    'pages/patient/PatientRegister.jsx', 'pages/result/AssessmentResult.jsx',
    'pages/sutlanding/SutLanding2.jsx', 'pages/assessment/formView/FormView.jsx',
    'pages/assessment/history/components/HistoryWidgets.jsx',
]
for name in visual_files:
    path = 'app/src/' + name
    baseline = BASE / path
    if not baseline.exists():
        continue
    current = (ROOT / path).read_text(encoding='utf8')
    text = baseline.read_text(encoding='utf8')
    # Keep the independently requested searchable options and their event contract.
    select_import = re.search(r'^import SearchableSelect from .*\n', current, re.M)
    if select_import and '<select' in text:
        text = select_import.group() + re.sub(r'<(/?)select\b', r'<\1SearchableSelect', text)
    if name == 'pages/admin/dashboard.jsx':
        text = text.replace('data={filteredData.slice(0, 10)}', 'data={filteredData}')
    if name == 'components/dashboard/SystemEvaluationWidget.jsx':
        # The checkpoint accidentally assigned dialog roles to the chart itself.
        text = re.sub(r'          className="ui-modal-overlay"\n          role="presentation"\n          onMouseDown=\{\(event\) => \{\n            if \(event.target === event.currentTarget\) setIsModalOpen\(false\);\n          \}\}\n', '', text, count=1)
        text = text.replace('            className="ui-modal"\n            role="dialog"\n            aria-modal="true"\n            aria-labelledby="system-evaluation-modal-title"\n', '', 1)
    if name == 'pages/helpCenter/ClinicHelpDetail.jsx':
        # Retain the broken-image fallback without its later presentation changes.
        text = text.replace('  const [selectedClinic, setSelectedClinic] = useState(null);', '  const [selectedClinic, setSelectedClinic] = useState(null);\n  const [failedClinicImage, setFailedClinicImage] = useState("");')
        image = re.search(r'            \{selectedClinic.image && selectedClinic.image !== failedClinicImage \? \([\s\S]*?            \)\}', current)
        if image:
            text = text.replace('            <img src={selectedClinic.image} alt={selectedClinic.name} />', image.group())
    write(path, text)

# Remove later theme overrides; keep organization routing and automatic scroll.
path = 'app/src/components/AdminLayout.jsx'
text = (ROOT / path).read_text(encoding='utf8').replace("import '../styles/admin-theme.css';\n", '')
text = re.sub(r'      <a className="suth-skip-link"[\s\S]*?</a>\n', '', text)
write(path, text)

# Align JS drawer thresholds with the original Sidebar.css (768px).
path = 'app/src/components/Sidebar.jsx'
text = (ROOT / path).read_text(encoding='utf8').replace('window.innerWidth > 1024', 'window.innerWidth > 768').replace('(min-width: 1025px)', '(min-width: 769px)').replace('color="currentColor"', 'color="#c94e07"')
write(path, text)

# Revert only color declarations in history while retaining new navigation/data fixes.
for path in ['app/src/pages/assessment/history/HistoryResult.jsx', 'app/src/pages/assessment/history/ClinicDetail.jsx']:
    old = (BASE / path).read_text(encoding='utf8').splitlines(True)
    now = (ROOT / path).read_text(encoding='utf8').splitlines(True)
    edits = []
    for tag, a, b, c, d in difflib.SequenceMatcher(None, old, now, autojunk=False).get_opcodes():
        if tag != 'replace' or b-a != d-c:
            continue
        prior, after = ''.join(old[a:b]), ''.join(now[c:d])
        color = r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|currentColor'
        if re.sub(color, 'COLOR', prior) == re.sub(color, 'COLOR', after):
            edits.append((c, d, old[a:b]))
        elif all(re.match(r'\s*(color|backgroundColor|border):', line) for line in old[a:b] + now[c:d]):
            edits.append((c, d, old[a:b]))
    for c, d, lines in reversed(edits):
        now[c:d] = lines
    write(path, ''.join(now))

# The chart palette is also consumed directly by JS.
path = 'app/src/utils/chartAggregation.js'
write(path, (BASE / path).read_text(encoding='utf8'))
for path in ['app/DESIGN.md', 'app/.impeccable/design.json']:
    write(path, (BASE / path).read_text(encoding='utf8'))

(OUT / 'applied.json').write_text(json.dumps({'checkpoint': '5240990c98674e4bc339656286eea3a3eab50e7e', 'checkpointLocalTime': '2026-10-15 09:57:32 Asia/Bangkok', 'changed': changed, 'preserved': ['server and data changes', 'authorization and organization routing', 'academic-year and guardian controls', 'searchable select behavior', 'history detail navigation and empty-data fixes']}, ensure_ascii=False, indent=2), encoding='utf8')
print('Restored', len(changed), 'files. Recovery copies:', BACK)
