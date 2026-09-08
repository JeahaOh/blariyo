"""Persistent operator-local HTTP server, cron scheduler and optional Discord Gateway."""
import argparse
import asyncio
import hmac
import json
import logging
import os
from pathlib import Path
from aiohttp import web
from collector import API, CollectError, Quota
from runtime import Runner


def create_app(runner, control_token, discord_client=None, discord_token=None):
    if not isinstance(control_token, str) or len(control_token) < 32 or not control_token.isascii():
        raise CollectError('CONFIG_INVALID')

    @web.middleware
    async def guard(request, handler):
        headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
        if request.headers.get('Origin'):
            return web.json_response({'errorCode': 'FORBIDDEN'}, status=403, headers=headers)
        auth = request.headers.get('Authorization', '')
        if not auth.isascii() or not hmac.compare_digest(auth, 'Bearer ' + control_token):
            return web.json_response({'errorCode': 'AUTH_REQUIRED'}, status=401, headers=headers)
        try:
            response = await handler(request)
        except CollectError as error:
            code = str(error)
            status = {'IDEMPOTENCY_CONFLICT': 409, 'QUEUE_FULL': 429, 'NOT_READY': 503}.get(code, 400)
            response = web.json_response({'errorCode': code}, status=status)
        except web.HTTPException as error:
            response = web.json_response({'errorCode': 'REQUEST_REJECTED'}, status=error.status)
        except Exception:
            response = web.json_response({'errorCode': 'REQUEST_FAILED'}, status=500)
        response.headers.update(headers)
        return response

    app = web.Application(middlewares=[guard], client_max_size=4096)
    async def health(request):
        return web.json_response({'status': 'READY' if runner.accepting and runner.worker and not runner.worker.done() and runner.scheduler and not runner.scheduler.done() else 'NOT_READY', 'activeRunId': runner.active_run,
                                  'discord': 'CONNECTED' if discord_client and discord_client.is_ready() else 'DISCONNECTED' if discord_client else 'DISABLED'})
    async def schedules(request):
        return web.json_response(runner.schedule.data())
    async def runs(request):
        return web.json_response({'items': runner.store.list()})
    async def detail(request):
        result = runner.store.get(request.match_info['run_id'])
        return web.json_response(result or {'errorCode': 'RUN_NOT_FOUND'}, status=200 if result else 404)
    async def submit(request):
        if request.content_type != 'application/json':
            raise CollectError('VALIDATION_FAILED')
        try:
            body = await request.json()
        except (ValueError, UnicodeError):
            raise CollectError('VALIDATION_FAILED')
        if not isinstance(body, dict) or set(body) - {'candidateId'}:
            raise CollectError('VALIDATION_FAILED')
        result = runner.submit('API', request.headers.get('Idempotency-Key'), body.get('candidateId'))
        return web.json_response(result, status=202)
    app.add_routes([web.get('/health', health), web.get('/v1/schedule', schedules),
                    web.get('/v1/runs', runs), web.post('/v1/runs', submit),
                    web.get('/v1/runs/{run_id}', detail)])

    async def lifecycle(app):
        await runner.start()
        discord_task = None
        if discord_client:
            async def connect():
                try:
                    await discord_client.start(discord_token)
                except Exception:
                    # Invalid/offline Discord must not take down cron or the HTTP server.
                    pass
            discord_task = asyncio.create_task(connect())
        try:
            yield
        finally:
            await runner.stop()
            if discord_client:
                await discord_client.close()
                if discord_task and not discord_task.done():
                    discord_task.cancel()
                if discord_task:
                    await asyncio.gather(discord_task, return_exceptions=True)
    app.cleanup_ctx.append(lifecycle)
    return app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--register-discord', action='store_true')
    args = parser.parse_args()
    config = json.loads(Path(os.environ['COLLECTOR_CONFIG']).read_text())
    settings = config.get('server', {})
    port = settings.get('port', 8787)
    if type(port) is not int or not 1024 <= port <= 65535 or not config.get('userAgent'):
        raise CollectError('CONFIG_INVALID')
    control = os.environ['COLLECTOR_CONTROL_TOKEN']
    if control == os.environ.get('COLLECTOR_TOKEN'):
        raise CollectError('CONFIG_INVALID')
    state = os.environ['COLLECTOR_STATE_DB']
    runner = Runner(API(), config, Quota(state), state)
    bot = None
    if config.get('discord', {}).get('enabled', False):
        from discord_bot import CollectorClient
        discord_settings = config['discord']
        if any(not discord_settings.get(key) or any(not str(v).isdigit() for v in discord_settings[key]) for key in ('guildIds', 'channelIds', 'userIds')):
            raise CollectError('CONFIG_INVALID')
        bot = CollectorClient(discord_settings, runner.api, config, runner.quota, args.register_discord, runner=runner)
    elif args.register_discord:
        raise CollectError('CONFIG_INVALID')
    logging.disable(logging.CRITICAL)
    web.run_app(create_app(runner, control, bot, os.environ.get('DISCORD_BOT_TOKEN')), host='127.0.0.1', port=port, access_log=None,
                print=lambda _: print(f'Collector server: http://127.0.0.1:{port}'))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('COLLECTOR_SERVER_UNAVAILABLE')
        raise SystemExit(1)
