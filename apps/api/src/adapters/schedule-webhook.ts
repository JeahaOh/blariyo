import type { ScheduleSender } from '../operations/schedule-alerts.service.js';
export function scheduleWebhook(url=process.env.SCHEDULE_ALERT_WEBHOOK_URL):ScheduleSender {
 return async event=>{
  if(!url)throw new Error('SCHEDULE_ALERT_NOT_CONFIGURED');
  const target=new URL(url);
  if(target.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&target.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(target.hostname)))
   throw new Error('SCHEDULE_ALERT_URL_INVALID');
  const result=await fetch(target,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(10000)});
  await result.body?.cancel();if(!result.ok)throw new Error('SCHEDULE_ALERT_DELIVERY_FAILED');
 };
}
