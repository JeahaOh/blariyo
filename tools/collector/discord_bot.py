"""Gateway slash commands only. No public inbound endpoint or message-content intent."""
import argparse
import hashlib
import asyncio
import json
import logging
import os
from pathlib import Path
import time
import discord
from discord import app_commands
from collector import API, CollectError, Quota, checked_url, process_job


def permitted(interaction, settings):
    return (str(interaction.guild_id) in settings['guildIds']
            and str(interaction.channel_id) in settings['channelIds']
            and str(interaction.user.id) in settings['userIds'])


class CollectorClient(discord.Client):
    def __init__(self, settings, api, config, quota, register=False, runner=None):
        super().__init__(intents=discord.Intents.none(), allowed_mentions=discord.AllowedMentions.none())
        self.settings, self.api, self.config, self.quota = settings, api, config, quota
        self.register = register
        self.runner = runner
        if runner:
            runner.listeners.append(self.completed)
        self.tree = app_commands.CommandTree(self)
        self.worker = None
        self.last_status, self.last_at = 'WAITING', None
        self.waiters, self.cooldowns = {}, {}
        self.group = app_commands.Group(name='collect', description='수집 보조')
        self.group.command(name='url', description='상세 글 URL 수집 요청')(self.collect_url)
        self.group.command(name='status', description='로컬 수집기 상태')(self.status)
        self.tree.add_command(self.group)

    async def setup_hook(self):
        if self.register:
            # Explicit opt-in; guild-scoped commands do not overwrite unrelated commands.
            for guild_id in self.settings['guildIds']:
                guild = discord.Object(id=int(guild_id))
                self.tree.copy_global_to(guild=guild)
                commands = self.tree.get_commands(guild=guild)
                for command in commands:
                    await self.http.upsert_guild_command(self.application_id, int(guild_id), command.to_dict(self.tree))
        if not self.runner:
            raise CollectError('CONFIG_INVALID')

    async def close(self):
        if self.worker:
            self.worker.cancel()
            try:
                await self.worker
            except asyncio.CancelledError:
                pass
        await super().close()

    async def status(self, interaction: discord.Interaction):
        if not permitted(interaction, self.settings):
            await interaction.response.send_message('허용된 운영자만 사용할 수 있습니다.', ephemeral=True)
            return
        if self.runner:
            recent = self.runner.store.list()
            status = recent[0]['status'] if recent else 'WAITING'
            await interaction.response.send_message(f'수집 서버: {status} · 예약: {self.runner.schedule.expression} ({self.runner.schedule.timezone})', ephemeral=True)
            return
        age = int(time.time() - self.last_at) if self.last_at else None
        await interaction.response.send_message(f'수집기: {self.last_status} · 최근 확인: {str(age) + "초 전" if age is not None else "아직 없음"}', ephemeral=True)

    async def collect_url(self, interaction: discord.Interaction, url: str):
        if not permitted(interaction, self.settings):
            await interaction.response.send_message('허용된 운영자만 사용할 수 있습니다.', ephemeral=True)
            return
        try:
            checked_url(url, [host for host, rules in self.config['sources'].items() if rules.get('enabled')])
        except Exception:
            await interaction.response.send_message('허용된 출처의 HTTPS 상세 글 URL을 입력해 주세요.', ephemeral=True)
            return
        now = time.monotonic()
        self.cooldowns = {k: v for k, v in self.cooldowns.items() if now - v < 10}
        if interaction.user.id in self.cooldowns:
            await interaction.response.send_message('잠시 후 다시 요청해 주세요.', ephemeral=True)
            return
        self.cooldowns[interaction.user.id] = now
        client = self
        class Confirmation(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=60)
                self.used = False

            @discord.ui.button(label='수집 요청 확인', style=discord.ButtonStyle.primary)
            async def confirm(self, clicked: discord.Interaction, button: discord.ui.Button):
                if self.used or clicked.user.id != interaction.user.id or not permitted(clicked, client.settings):
                    await clicked.response.send_message('확인할 수 없는 요청입니다.', ephemeral=True)
                    return
                self.used = True
                # Acknowledge before any Core or external source I/O.
                await clicked.response.defer(ephemeral=True, thinking=True)
                try:
                    result = await asyncio.to_thread(client.api.call, '/candidates', {'collectorId': client.api.collector, 'originUrl': url}, key=hashlib.sha256(('discord:' + str(interaction.id)).encode()).hexdigest())
                    candidate_id = result['candidateId']
                    client.waiters[candidate_id] = (clicked, time.time())
                    client.runner.submit('DISCORD', str(interaction.id), candidate_id)
                    await clicked.edit_original_response(content=f'후보 #{candidate_id} 수집을 접수했습니다. 검수 화면에서 확인해 주세요.')
                except Exception:
                    await clicked.edit_original_response(content='접수하지 못했습니다. 검수 화면에서 확인 후 다시 요청해 주세요.')
                self.stop()
        await interaction.response.send_message('이 상세 글의 제목과 이미지를 검수 후보로 수집할까요?', view=Confirmation(), ephemeral=True)

    async def completed(self, result):
        self.last_status, self.last_at = result['status'], time.time()
        waiter = self.waiters.pop(result['candidateId'], None)
        if waiter and time.time() - waiter[1] < 14 * 60:
            await waiter[0].edit_original_response(content=f'후보 #{result["candidateId"]}: {result["status"]}. 검수 화면에서 확인해 주세요.')
        self.waiters = {k: v for k, v in self.waiters.items() if time.time() - v[1] < 14 * 60}


def main():
    # Keep the old entry point as an alias to the same persistent server.
    import sys
    from server import main as serve
    sys.argv = ['server.py'] + ['--register-discord' if arg == '--register' else arg for arg in sys.argv[1:]]
    serve()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('DISCORD_UNAVAILABLE')
        raise SystemExit(1)
