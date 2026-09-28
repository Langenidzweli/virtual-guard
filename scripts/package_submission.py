"""Build a clean repository distribution ZIP without changing the working installation."""
from pathlib import Path
import argparse, hashlib, json, os, re, zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output'
DOCS = {'SETUP.md', 'ARCHITECTURE.md', 'MODEL_EVALUATION.md'}
EXCLUDE_DIRS = {'.git','.vscode','.idea','node_modules','dist','target','__pycache__',
                '.pytest_cache','.mypy_cache','.ruff_cache','.ultralytics','.venv','venv','venv313',
                'uploads','output','models-archives','coverage','htmlcov','playwright-report',
                'test-results','modernize'}
ROOT_FILES = {'README.md','LICENSE','.env.example','.gitignore','.gitattributes',
              '.editorconfig','docker-compose.yml'}
SOURCES = {'frontend','backend','ai-service','scripts','.github','docs'}

def include(path, profile="full"):
    parts = path.relative_to(ROOT).parts
    if len(parts)==1: return path.name in ROOT_FILES
    if parts[0] not in SOURCES: return False
    if path.name == 'PHASE5_README.md': return False
    if profile == 'portfolio' and parts[:2] == ('ai-service', 'datasets'):
        if len(parts) < 4 or parts[2] != 'features': return False
    if any(part in EXCLUDE_DIRS or part.startswith('venv') for part in parts[:-1]): return False
    if parts[0]=='docs':
        return (len(parts)==2 and path.name in DOCS) or (
            len(parts)==3 and parts[1]=='images' and (path.suffix.lower() in {'.png','.jpg','.jpeg','.svg','.webp'} or path.name=='.gitkeep'))
    if parts[0] in {'frontend','backend'} and path.name=='README.md': return False
    if 'weights' in parts and parts[0]=='ai-service' and 'runs' in parts: return False
    if path.name.startswith('.env') and path.name!='.env.example': return False
    if path.name in {'.DS_Store','Thumbs.db','Desktop.ini','.coverage'}:return False
    if path.suffix in {'.pyc','.pyo','.log','.tsbuildinfo','.cache','.zip'}:return False
    if path.name.startswith('events.out.tfevents.') or path.name.endswith('.zip.part'):return False
    if path.name.startswith('tmp_') and path.suffix=='.mp4':return False
    return True

def files(profile="full"):
    for current, dirs, names in os.walk(ROOT, followlinks=False):
        dirs[:] = [name for name in dirs if name not in EXCLUDE_DIRS and not name.startswith('venv') and not (Path(current)/name).is_symlink()]
        for name in names:
            path=Path(current)/name
            if not path.is_symlink() and include(path, profile):yield path

def private_values():
    values=[]
    for env_file in [ROOT/'.env',ROOT/'ai-service/.env',ROOT/'frontend/.env',ROOT/'frontend/.env.local',ROOT/'frontend/.env.production']:
        if not env_file.exists():continue
        for line in env_file.read_text(encoding='utf-8-sig').splitlines():
            if '=' not in line or line.lstrip().startswith('#'):continue
            key,value=line.split('=',1);value=value.strip().strip('"').strip("'")
            if any(word in key.upper() for word in ['PASSWORD','SECRET','API_KEY','TOKEN']) and len(value)>=8:values.append(value.encode())
    return values

REQUIRED = {
    'README.md', '.env.example', 'docker-compose.yml',
    'frontend/package.json', 'frontend/package-lock.json', 'frontend/Dockerfile.runtime',
    'frontend/nginx.conf', 'frontend/src/main.tsx', 'backend/pom.xml',
    'backend/Dockerfile.runtime', 'ai-service/Dockerfile', 'ai-service/requirements.txt',
    'ai-service/requirements-dev.txt', 'ai-service/app/main.py',
    'docs/ARCHITECTURE.md', 'docs/SETUP.md', 'docs/MODEL_EVALUATION.md',
    *('ai-service/models/' + name for name in (
        'yolov8n.pt', 'virtual_guard_mall_detector_v1.pt',
        'virtual_guard_mall_detector_v2.pt', 'yolov8n-pose.pt',
        'behaviour_model_v2.pkl', 'scaler_v2.pkl')),
}


def validate_selection(selected, private):
    names = {path.relative_to(ROOT).as_posix() for path in selected}
    missing = REQUIRED - names
    if missing:
        raise SystemExit('Missing required package files: ' + ', '.join(sorted(missing)))
    forbidden = []
    for path in selected:
        if path.suffix.lower() in {'.md','.py','.ts','.tsx','.java','.json','.yml','.yaml',
                                  '.xml','.txt','.csv','.ps1','.properties','.example','.svg','.sh','.mjs'}:
            data = path.read_bytes()
            if any(value in data for value in private) or re.search(
                rb'(?:ghp_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})', data
            ):
                forbidden.append(path.relative_to(ROOT).as_posix())
    if forbidden:
        raise SystemExit('Potential private configuration in package files: ' + ', '.join(sorted(set(forbidden))))


def build(profile, selected):
    destination = OUTPUT / ('VirtualGuard-V1-' + profile.title() + '.zip')
    temporary = destination.with_suffix('.zip.part')
    manifest = {}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in selected:
            name = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            archive.writestr('virtual-guard-v1/' + name, data)
            manifest[name] = hashlib.sha256(data).hexdigest()
        archive.writestr('virtual-guard-v1/SUBMISSION_MANIFEST.json', json.dumps(manifest, indent=2))
    with zipfile.ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('ZIP integrity check failed')
        expected = {'virtual-guard-v1/' + name for name in manifest}
        expected.add('virtual-guard-v1/SUBMISSION_MANIFEST.json')
        if set(archive.namelist()) != expected or len(archive.namelist()) != len(expected):
            raise RuntimeError('Unexpected or duplicate archive entry')
        for name, checksum in manifest.items():
            if not include(ROOT / name, profile):
                raise RuntimeError('Excluded file entered archive: ' + name)
            if hashlib.sha256(archive.read('virtual-guard-v1/' + name)).hexdigest() != checksum:
                raise RuntimeError('Manifest mismatch: ' + name)
    temporary.replace(destination)
    checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.zip.sha256').write_text(checksum + '  ' + destination.name + '\n', encoding='utf-8')
    print(f'{destination.name}: {len(manifest) + 1} entries, {destination.stat().st_size / 1048576:.2f} MiB; SHA-256 {checksum}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', choices=('full', 'portfolio', 'both'), default='full')
    args = parser.parse_args()
    profiles = ('full', 'portfolio') if args.profile == 'both' else (args.profile,)
    selections = {profile: sorted(files(profile)) for profile in profiles}
    private = private_values()
    # Validate every selected profile before writing any archive.
    for selected in selections.values():
        validate_selection(selected, private)
    for profile, selected in selections.items():
        build(profile, selected)


if __name__ == '__main__':
    main()
