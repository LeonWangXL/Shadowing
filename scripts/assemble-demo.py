from pathlib import Path
import wave, json
root = Path(__file__).resolve().parent.parent / 'public'
texts = [
 ('I used to think progress had to be dramatic.', '我曾以为，进步必须是巨大的。'),
 ("But over time, I realized that's not true.", '但慢慢地，我发现并非如此。'),
 ('Small steps make a big difference.', '小小的进步也能带来巨大的改变。'),
 ("You don't have to be perfect to move forward.", '你不必做到完美，才能继续前行。'),
 ('What matters is showing up, again and again.', '重要的是，一次又一次地付诸行动。'),
 ('Each little effort builds your confidence.', '每一点努力，都在积累你的信心。'),
 ('And confidence helps you go further.', '而信心，会让你走得更远。'),
 ('So be patient with yourself, and keep going.', '所以，对自己多一点耐心，坚持下去。')
]
segments = []
with wave.open(str(root / 'demo.wav'), 'wb') as output:
    cursor = 0
    for i, (text, translation) in enumerate(texts):
        with wave.open(str(root / 'demo-clips' / f'{i}.wav'), 'rb') as clip:
            if i == 0:
                output.setparams(clip.getparams())
                rate = clip.getframerate()
                size = clip.getsampwidth() * clip.getnchannels()
            gap_frames = int(rate * .65)
            output.writeframes(b'\0' * gap_frames * size)
            cursor += gap_frames / rate
            frames = clip.getnframes()
            segments.append(dict(id=f's{i+1}', start=round(cursor, 3), end=round(cursor + frames / rate, 3), text=text, translation=translation))
            output.writeframes(clip.readframes(frames))
            cursor += frames / rate
    output.writeframes(b'\0' * int(rate * .5) * size)
(root / 'demo.json').write_text(json.dumps(segments, ensure_ascii=False, indent=2), encoding='utf-8')
def timestamp(value):
    ms = round(value * 1000)
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
(root / 'demo.srt').write_text('\n\n'.join(f"{i+1}\n{timestamp(s['start'])} --> {timestamp(s['end'])}\n{s['text']}\n{s['translation']}" for i,s in enumerate(segments)), encoding='utf-8')
print(f'Demo: {len(segments)} segments, {cursor:.2f}s, Microsoft Zira synthetic voice')
