from pathlib import Path
import subprocess, os, re, json
root = Path(r'D:\github-clone\suth-suthiecare')
paths = ['app/src/components/floating/FloatingActions.jsx', 'app/src/components/floating/FloatingActions.css', 'app/src/assets/pee-hom-ai.webp']
landing = 'app/src/pages/sutlanding/SutLanding2.jsx'
worktrees = {
    'agency': root / '.worktrees/agency',
    'production': root / '.worktrees/production',
    'claude/registration-uxui-improvement-872c18': root / '.claude/worktrees/registration-uxui-improvement-872c18',
    'main': None,
}
def git(*args, cwd=root, data=None, env=None):
    result = subprocess.run(['git', *args], cwd=cwd, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace'))
    return result.stdout

def integrate(content):
    text = content.decode('utf-8').replace('\r\n','\n')
    if 'import FloatingActions ' not in text:
        anchor = 'import "./SutLanding2.css";'
        assert text.count(anchor) == 1
        text = text.replace(anchor, 'import FloatingActions from "../../components/floating/FloatingActions.jsx";\n' + anchor)
    if '<FloatingActions />' not in text:
        text, count = re.subn(r'      <button\s+className="sut2-floating-help-btn"[\s\S]*?</button>', '      <FloatingActions />', text)
        assert count == 1, 'Expected exactly one original help launcher'
    return text.encode('utf-8')

source = {path: git('show', '180a131:' + path) for path in paths}
records=[]
for branch, workspace in worktrees.items():
    old = git('rev-parse', 'refs/heads/' + branch).decode().strip()
    old_landing = git('show', old + ':' + landing)
    new_landing = integrate(old_landing)
    scoped = dict(source)
    if new_landing != old_landing:
        scoped[landing] = new_landing
    backup = root / 'outputs/pee-hom-preexisting' / branch.replace('/','_')
    backup.mkdir(parents=True, exist_ok=True)
    if workspace:
        staged = git('diff', '--cached', '--name-only', cwd=workspace).decode().splitlines()
        assert not set(staged) & set(scoped), 'Existing staged edits on target files'
        for path in scoped:
            current = workspace / path
            if current.exists():
                dest = backup / path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(current.read_bytes())
        before_other = git('diff', '--binary', '--', '.', *[':(exclude)' + p for p in scoped], cwd=workspace)
        current_landing = (workspace / landing).read_bytes()
        desired_landing = integrate(current_landing)
        # Preserve every unrelated landing-page edit in the working file.
        if landing not in scoped:
            assert desired_landing == current_landing.replace(b'\r\n', b'\n')
    index = backup / 'scoped.index'
    assert not index.exists()
    env = dict(os.environ, GIT_INDEX_FILE=str(index))
    git('read-tree', old, env=env)
    for path, content in scoped.items():
        blob = git('hash-object', '-w', '--stdin', data=content).decode().strip()
        git('update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + path, env=env)
    tree = git('write-tree', env=env).decode().strip()
    commit = git('commit-tree', tree, '-p', old, '-m', 'Use Pee Hom mascot for the homepage AI chat invitation').decode().strip()
    changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).decode().splitlines()
    assert set(changed) <= set(scoped)
    git('update-ref', 'refs/heads/' + branch, commit, old)
    if workspace:
        for path in paths:
            dest = workspace / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(source[path])
        if landing in scoped:
            (workspace / landing).write_bytes(desired_landing)
        git('reset', '-q', 'HEAD', '--', *scoped, cwd=workspace)
        after_other = git('diff', '--binary', '--', '.', *[':(exclude)' + p for p in scoped], cwd=workspace)
        assert before_other == after_other, 'Unrelated edits changed'
    index.unlink()
    records.append({'branch': branch, 'before': old, 'commit': commit, 'files': changed})
    print(branch + ': ' + commit[:7] + ' (' + str(len(changed)) + ' scoped files; unrelated edits preserved)')
(root / 'outputs/pee-hom-branches.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
