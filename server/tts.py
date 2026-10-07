import asyncio
import json
import sys
import edge_tts


async def main():
    request = json.loads(sys.stdin.buffer.read().decode('utf-8'))
    async for chunk in edge_tts.Communicate(request['text'], request['voice']).stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])


asyncio.run(main())
