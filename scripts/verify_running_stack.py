"""Opt-in local regression: creates and removes only UUID-scoped test records/media.
Run with the AI virtualenv from the repository root while Compose is running.
Reads private .env without printing credentials. Does not train or alter models.
"""
from pathlib import Path
import json, os, subprocess, tempfile, time, uuid
import cv2
import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
config = dotenv_values(ROOT / '.env')
BASE = 'http://localhost:' + config.get('BACKEND_PORT', '8090')
run = uuid.uuid4().hex
camera_id = 'submission_' + run
email = 'submission_' + run + '@example.invalid'
password = 'Fixture-' + uuid.uuid4().hex
new_password = 'Personal-' + uuid.uuid4().hex
steps = []

def api(method, path, token=None, expected=200, **kwargs):
    headers = kwargs.pop('headers', {})
    if token: headers['Authorization'] = 'Bearer ' + token
    response = requests.request(method, BASE + path, headers=headers, timeout=180, **kwargs)
    assert response.status_code == expected, f'{method} {path}: expected {expected}, got {response.status_code}'
    return response.json() if response.content and 'json' in response.headers.get('Content-Type','') else None

def login(pwd, account=email, expected=200):
    return api('POST','/api/auth/login',expected=expected,json={'email':account,'password':pwd})

def cleanup():
    sql = f"""BEGIN;
DELETE FROM incidents WHERE job_id IN (SELECT id FROM processing_jobs WHERE camera_id='{camera_id}');
DELETE FROM processing_jobs WHERE camera_id='{camera_id}';
DELETE FROM cameras WHERE id='{camera_id}';
DELETE FROM guards WHERE email='{email}';
DELETE FROM users WHERE email='{email}';
COMMIT;"""
    result = subprocess.run(['docker','compose','exec','-T','postgres','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'],input=sql,text=True,cwd=ROOT,capture_output=True)
    assert result.returncode == 0, 'Fixture database cleanup failed; inspect submission test records'
    uploads=(ROOT/'backend/uploads').resolve()
    for file in uploads.glob('submission_'+run+'*'):
        assert file.resolve().parent == uploads
        if file.is_file(): file.unlink()

try:
    admin = login(config['BOOTSTRAP_PASSWORD'], 'admin@virtualguard.com')['accessToken']
    steps.append('ADMIN login')
    guard=api('POST','/api/guards',admin,201,json={'name':'Submission Fixture','email':email,'phone':'0000000000','badgeNumber':'S-'+run[:12],'password':password})
    token=login(password)['accessToken']
    api('GET','/api/guards',token,403)
    api('POST','/api/guards/'+guard['id']+'/reset-password',token,403)
    api('POST','/api/cameras',token,403,json={})
    steps.append('Guard create/login and backend ADMIN authorization')
    api('PUT','/api/guards/'+guard['id'],admin,json={'name':'Updated Fixture','email':email,'phone':'0000000001','badgeNumber':'S-'+run[:12]})
    api('POST','/api/guards/'+guard['id']+'/reset-password',admin,204)
    api('GET','/api/jobs',token,401)
    login(password,expected=401)
    restricted=login(config['GUARD_TEMPORARY_PASSWORD'])
    assert restricted['user']['mustChangePassword'] is True
    token=restricted['accessToken']
    api('GET','/api/jobs',token,403)
    api('POST','/api/video/fixture.mp4/ticket',token,403)
    api('POST','/api/auth/change-password',token,400,json={'currentPassword':'incorrect','newPassword':new_password,'confirmPassword':new_password})
    changed=api('POST','/api/auth/change-password',token,json={'currentPassword':config['GUARD_TEMPORARY_PASSWORD'],'newPassword':new_password,'confirmPassword':new_password})
    assert changed['user']['mustChangePassword'] is False
    api('GET','/api/jobs',token,401)
    api('POST','/api/auth/refresh',expected=401,json={'refreshToken':restricted['refreshToken']})
    token=login(new_password)['accessToken']
    api('GET','/api/jobs',token)
    steps.append('Reset, revoked access/refresh, forced change, wrong-current rejection, new-password login')
    for status in ['SUSPENDED','ACTIVE','DEACTIVATED','ACTIVE']:
        api('PATCH',f"/api/guards/{guard['id']}/status?status={status}",admin)
        login(new_password,expected=200 if status=='ACTIVE' else 401)
    steps.append('Suspend/reactivate/deactivate/reactivate')
    token=login(new_password)['accessToken']
    camera={'id':camera_id,'label':'Submission fixture','x':25,'y':65,'monitored':True,'siteId':'','streamUrl':''}
    api('POST','/api/cameras',admin,json=camera)
    camera['x']=35
    updated=api('PUT','/api/cameras/'+camera_id,admin,json=camera)
    assert updated['x']==35
    api('PUT','/api/cameras/'+camera_id,token,403,json=camera)
    assert any(c['id']==camera_id for c in api('GET','/api/cameras',token))
    steps.append('Camera list/create/configuration/map and write authorization')
    with tempfile.TemporaryDirectory() as temp:
        video=Path(temp)/('submission_'+run+'.mp4')
        source=next((ROOT/'ai-service/datasets/shoplifting_pose').rglob('*.mp4'))
        cap=cv2.VideoCapture(str(source)); writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'mp4v'),10,(320,240))
        count=0
        for _ in range(30):
            ok,frame=cap.read()
            if not ok:break
            writer.write(cv2.resize(frame,(320,240)));count+=1
        cap.release();writer.release();assert count>0
        with video.open('rb') as f:
            job=api('POST','/api/jobs',token,202,files={'file':(video.name,f,'video/mp4')},data={'cameraId':camera_id})
        assert job['status']=='QUEUED'
        assert '_browser.mp4' in job['videoFileName'], 'Conversion did not produce browser MP4'
        api('POST',f"/api/jobs/{job['jobId']}/start",token,202)
        for _ in range(150):
            result=api('GET',f"/api/jobs/{job['jobId']}",token)
            if result['status'] in ['COMPLETED','FAILED']:break
            time.sleep(2)
        assert result['status']=='COMPLETED', 'Video analysis did not complete'
        assert result['behaviour'] in ['normal','shoplifting']
        assert result['annotatedVideoFileName']
        ticket=api('POST','/api/video/'+result['annotatedVideoFileName']+'/ticket',token)['ticket']
        media=requests.get(BASE+'/api/video/'+result['annotatedVideoFileName'],params={'ticket':ticket},headers={'Range':'bytes=0-1023'},timeout=20)
        assert media.status_code==206 and len(media.content)==1024
        api('GET','/api/video/'+result['annotatedVideoFileName'],expected=401)
        steps.append('Real upload/convert/job/analyze/V2 vision/behaviour/annotation/callback/persistence/ranged media')
    records=api('GET','/api/incidents',token)
    incident=next((i for i in records if i.get('jobId')==job['jobId']),None)
    if incident is None:
        # Exercise incident review with an explicitly synthetic callback fixture,
        # separate from the real inference result. Never overwrite model outputs.
        with video.open('rb') if video.exists() else open(ROOT/'backend/uploads'/job['videoFileName'],'rb') as f:
            review_job=api('POST','/api/jobs',token,202,files={'file':('submission_'+run+'_review.mp4',f,'video/mp4')},data={'cameraId':camera_id})
        sql=f"UPDATE processing_jobs SET status='PROCESSING',attempt_id='{uuid.uuid4()}',attempt_count=1 WHERE id='{review_job['jobId']}' RETURNING attempt_id;"
        q=subprocess.run(['docker','compose','exec','-T','postgres','sh','-c','psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'],input=sql,text=True,cwd=ROOT,capture_output=True)
        assert q.returncode==0
        attempt=str(uuid.UUID(q.stdout.splitlines()[0]))
        api('POST',f"/internal/jobs/{review_job['jobId']}/callback?attemptId={attempt}",headers={'X-API-Key':config['INTERNAL_API_KEY']},json={'behaviour':'shoplifting','confidence':0.8,'suspicion_score':75,'detections':[],'detection_summary':{},'annotated_video_path':result['annotatedVideoFileName'],'vision_status':'completed','review_segments':[]})
        incident=next(i for i in api('GET','/api/incidents',token) if i.get('jobId')==review_job['jobId'])
        steps.append('Separate synthetic callback fixture used for incident review')
    detail=api('GET','/api/incidents/'+incident['id'],token)
    assert detail['evidence'] is not None
    api('POST','/api/incidents/'+incident['id']+'/notes',token,json={'text':'Submission regression fixture', 'id':str(uuid.uuid4())})
    reviewed=api('PATCH','/api/incidents/'+incident['id']+'/review?status=DISMISSED',token)
    assert reviewed['reviewStatus']=='DISMISSED'
    steps.append('Incident list/detail/evidence/note/review persistence')
finally:
    cleanup()
    report=ROOT/'output/submission-audit/live-regression.json'
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({'passed_steps':steps,'test_records_removed':True},indent=2))
print('PASS:', '; '.join(steps), '; test records/media removed')
