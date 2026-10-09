import json,subprocess
units=['blariyo-publish','blariyo-outbox','blariyo-cleanup','blariyo-collection','blariyo-discord-review','blariyo-discord-review-scan','blariyo-nightly-main-deploy','blariyo-backup','blariyo-log-retention']
result=[]
for unit in units:
 timer=unit+'.timer'
 active=subprocess.check_output(['systemctl','is-active',timer],text=True).strip()
 enabled=subprocess.check_output(['systemctl','is-enabled',timer],text=True).strip()
 assert active=='active' and enabled=='enabled'
 next_run=subprocess.check_output(['systemctl','show',timer,'-p','NextElapseUSecRealtime','--value'],text=True).strip()
 result.append({'timer':timer,'active':active,'enabled':enabled,'nextRun':next_run})
print(json.dumps(result,indent=2))
