# Echo / 方案 1 视觉与交互验证

**final result: passed**

## 比较目标与证据

- 视觉来源：`qa/reference.png`。这是用户选择的第一个 ImageGen 结果，原始文件为 `C:\Users\wesly1\.codex\generated_images\01a10ad2-bfd4-7621-8f50-37371830c6ca\exec-cb946f9c-503a-466b-abec-fe27c1e1f04b.png`。
- 实现：`http://127.0.0.1:4173/`，练习页，浅色，示例第 3 句，1.0x，循环开启，无录音、无评测。
- 桌面截图：`qa/desktop-final.jpg`；全景联合对比：`qa/comparison.jpg`。
- 专门比较了标题／主要操作：`qa/comparison-type.jpg`；字幕区域：`qa/comparison-transcript.jpg`。不是仅凭全屏缩略图做结论。
- CSS 视口 1440 × 1024，浏览器 DPR 约 1。参考像素 1487 × 1058，截图接口返回 1425 × 1013；分别按基本相同的宽高比例归一化至 1440 × 1024，拼接后打开、观察。归一化不用于主张逐像素一致。
- 手机视口 390 × 844：`qa/mobile-recording.jpg`。包含明确用于界面验证的合成测试录音，不是真人录音，未产生任何发音评分。测试后已清理。
- 中等宽度 1024 × 900：`qa/tablet.jpg`。

## 五个必要表面

| 表面 | 结论与处理 |
|---|---|
| 字体与排版 | 使用 Lora／Georgia 的衬线层级、DM Sans／微软雅黑操作文字；主句保持一行（桌面示例），中文说明弱化。字体加载状态为 loaded。移动主句自然换行。与源图的小字号细节存在少量 P3 差异。 |
| 布局与间距 | 保留左右双列、约 1.53:1 比例、左侧宽播放器与大句子、右侧列表及简洁反馈、底部四步骤。修正过列表末行裁切、主按钮宽度和移动设置挤压。桌面工作流底部约 y=1021，在 1024 视口内。 |
| 颜色与视觉变量 | 白色主表面、深森林绿 #174c40、淡绿选中行 #e8efe8、弱灰字幕时间、米色未评测状态，与选定方向一致；图标和控件没有用手绘 SVG 或图形替代。 |
| 图像与素材 | 单独生成 16:9 暖色室内讲述者封面，检查了主题、构图和锐度。图片是静态封面，UI 明确标记合成音频，不冒充源图中的真人视频。用户导入视频时显示真实视频。 |
| 文案与内容 | 保留源图的 8 句英文、小步前进主句、中文译文、听／读／比／重练层级。将示意时间换为真实 WAV 的准确分句时间，约 33.66 秒；未配置服务时显示“尚未评测”，不能出现伪评分。 |

## 发现与修正历史

1. **[P2] 字幕第 8 行默认被裁切。** 初版见 `qa/desktop-initial.jpg`；将桌面字幕区高度、字号及行间距调整，使示例 8 行完整可见。修正后见 `qa/desktop-final.jpg` 与字幕局部对比。
2. **[P2] 默认反馈区过高，挤出底部练习步骤。** 将无录音状态收为一行标题、短说明、评测入口和状态；调整工作流上方间距。修正后步骤在 1440 × 1024 内显示。录音后按内容扩展反馈属于不同状态，允许页面纵向滚动。
3. **[P2] 手机语速标签挤成竖列。** 390 像素验证发现。把主操作改为两列网格，语速与循环位于第二行；修正后 `qa/mobile-recording.jpg` 和 DOM 边界检查均无横向溢出。
4. **[P2] 原声／录音回放会暂停自身。** 交互检查后改为仅暂停其他录音；合成测试录音点击播放时 DOM 显示 paused=false。
5. **[P1] 同步录音起始存在采集未就绪的截断。** 初期合成测试 1 秒片段只保存约 0.66 秒。增加 worklet 输入就绪与开始采集握手，再播放原声；复测保存约 1.03–1.04 秒。此项是功能问题，已修复。
6. **[P2] 切换本地文件的短暂空 src 警告。** Blob URL 建立前传 undefined；最终生产页面重新验证，没有新增相关警告。

中途曾截到页面切换尚未完成的复习页，未据此判定匹配；重新读取浏览器状态并捕获稳定练习页后，才制作最终联合对比。

## 交互与工程验证

- 真正的本地音频 + SRT 文件选择、导入、保存和刷新恢复成功。初次浏览器文件接口失败，改用可见 input 的 filechooser 流程后成功。
- 原声播放按句尾停止；速度与循环设置、隐藏字幕可切换。
- 书签加入复习、复习页返回相应句子；清理测试书签后显示空态。
- 编辑表单能拒绝结束时间早于开始时间，再保存有效时间。
- 合成测试验证先听后读两句 × 两遍得到 4 条 WAV；同步跟读同样 4 条。16kHz、单声道 PCM 的头部与实际样本可解码。
- IndexedDB 保留真实音频 Blob；回放和选择录音反馈有效。移除先出现确认，取消保留录音。
- 停止练习后不继续录音或跳进下一遍。截图见 `qa/recording-stop.jpg`。
- 未配置 Azure 时显示可操作的配置说明，不制造评分。见 `qa/assessment-unconfigured.jpg`。
- 单元与接口测试 13 项、Sites 打包测试 4 项通过；TypeScript 与生产构建通过。
- 生产 Node 服务提供页面、静态资源、短音频 Range 请求和 API health；开发诊断页面不进入生产构建。
- 正式生产页面已重新打开并播放单句，browser console 的 error / warn 列表为空；补充截图 `qa/production.jpg` 是播放中状态。
- 浏览器 console 已检查：开发时添加 hook 导致的旧 HMR 错误通过刷新恢复；最终生产加载重新检查。未将旧开发日志当成当前运行问题。

## 明确的验证限制

- 没有采集用户真实麦克风。合成信号证明采集、编码、流程与持久化运行，不证明具体物理设备、权限弹窗、串音或英语学习效果。
- 没有真实 Azure 凭据，云评测只完成请求／结果映射的模拟服务测试，未完成真实收费服务联调。
- 手机为浏览器窄视口验证，不是实体 iOS／Android 设备验证。
- 首版仍为个人本地运行版本，未部署公网，未增加多人身份／配额体系。

## P3 后续优化

- 源图人物、眼睛方向与最终生成封面存在差别；整体色温、衣着、场景和构图保持一致。
- 微调顶部导航位置和小字尺寸；真实功能多出的字幕编辑、书签和展开设置属于有意补充。
- 增加自动字幕、真实录音的原声对齐和设备兼容性验证，按实际使用反馈推进。

## 实现核对

- [x] 打开参考与浏览器渲染结果，并以联合输入比较。
- [x] 修正 P0/P1/P2，重新捕获并比较。
- [x] 检查字体、布局、颜色、图像与文案。
- [x] 检查桌面、手机、导入、录音、复习与错误状态。
- [x] 保留生产预览与源码，说明实测边界。

final result: passed


2026-10-05 longer practice update: added automatic / 30-second / 1-minute / 2-minute / 5-minute listen-then-record durations, elapsed / limit display, bounded five-minute capture buffers and explicit long-recording assessment explanation. Real browser synthetic capture crossed the prior cap: 33.699 seconds, WAV 16kHz mono PCM, decoded successfully and retrieved from IndexedDB. This verifies the >30-second path, not a full five-minute microphone capture. Core duration tests cover long segments, slow playback and five-minute cap. Existing continuous sentence progression remains available.


2026-10-05 long SRT update: removed fixed cue-count, per-cue text-length and hour-digit caps. Transcript renders at most 100 rows, with page controls and validated cue-number jump. Automated parsing verified 50,000 cues covering 99,999 seconds and a 10,000-character cue. Production browser import verified 3,000 cues, page 2 beginning at cue 101, cue 3,000 jump, and reload restoration. Proof: qa/long-srt.jpg (synthetic timing fixture, not natural speech alignment). Build and all 19 tests pass. Physical maximum remains browser memory / IndexedDB quota. Media retains its independent 200MB limit.


Resource downloads: original imported media and subtitle retained as IndexedDB blobs with original filenames; old imports explicitly offer current-SRT export only. Browser refresh verified native download links and persisted original subtitle. SRT round-trip tested including bilingual edits and long timelines. Build and 20 tests pass. Browser download-event and downloadMedia APIs timed out for local blob links, so actual disk download is not verified in this environment. Screenshot: qa/resource-downloads.jpg.


Resource deletion: persistent recycle bin, restoration, explicit permanent-purge confirmation and atomic cascade removal implemented. Browser tested archive of current test resource, refresh persistence, restoration and bookmark restoration. Permanent purge confirmation reviewed but destructive final action not executed. Purge transaction and related recording restoration require further integration coverage; existing 20 automated checks do not cover deletion. Proof: qa/resource-deletion.jpg. Detailed review: IMPROVEMENTS.md.


Subtitle overflow fix: imports and edits preserve cues beyond media duration. Page warns instead of rejecting import; playback clamps end boundary, full out-of-range practice exits before requesting mic. Paused seek no longer changes selected cue through timeupdate. Browser imported 35/45-second cues with 33.65-second demo, played the partial final cue to completion, selected full out-of-range cue and verified explicit stop without mic request, then reloaded and confirmed persistence. Build and 21 tests pass. Screenshot: qa/subtitle-overflow.jpg.


Playback boundary fix: removed index-driven seek effect that rewound continuous playback whenever timeupdate changed the active subtitle. Manual selection retains explicit seek. Single-segment playback now pauses, awaits seeked with cancellation/error/timeout cleanup, then plays; removed 25ms early cutoff. Node regression verifies asynchronous seek completion and cancellation. Development browser harness rendered real App and logged media events: uninterrupted demo passed all 8 cues with only initial seek; manual cue 4 emitted seeking 13.177, seeked 13.177, then play 13.186. Evidence: qa/playback-events.txt and qa/playback-regression.jpg. Build and 22 automated tests passed. User media not supplied, so exact audible tail from their encoding or cue timestamps is not verified.


Multi-sentence mode: groups of 2/3/5/10 contiguous cues, merged text and translations, distinct group IDs and member cue IDs on attempts, grouped listen/shadow/repeat/automatic progression, group navigation and transcript highlight. Browser UI verified 1–3 -> 4–6 -> 7–8 progression. Real capture integration with synthetic stream tested two-cue group twice in shadow (5.189/5.211 seconds) and listen mode (6.408/6.419 seconds), persisted and decoded WAV with combined reference and group identity. Core tests cover gaps, tail groups and identity separation. Build and 23 tests passed. Recorded signal is synthetic, no real mic or cloud assessment tested. Proof: qa/group-practice.jpg.


Waveform comparison: explicit local decoding of source audio and selected recording; RMS envelopes with common timeline and amplitude scale, silent tail space, stereo energy combining and capture-time reference bounds/rate. Browser generated original 11.9s and synthetic recording 5.2s waveforms and displayed actual canvas rendering; fixture removed after screenshot. Unit tests verify silence, source slicing, opposite-phase stereo and slowed timeline. Build and 24 tests passed. Evidence qa/waveform-compare.jpg uses synthetic tone recording, not real pronunciation or assessment. Whole-source decoding may use considerable memory for large media; unsupported browser audio-track decoding reports a fallback message.


Recording-first waveform: selected recording auto-decodes without fetching original media. Original only decodes on explicit compare, recording stays first, shared axes recomputed for the comparison. Browser verified one recording canvas and zero original canvases before click, two tracks after click. Synthetic fixture removed after screenshot qa/recording-waveform-first.jpg. Build and 24 existing tests passed.

Source waveform OOM fix: removed whole-source fetch/ArrayBuffer/decodeAudioData. Detached media player streams the selected reference range through an AudioWorklet; only 240 RMS energy/count bins retained, silent output, progress and cancellation. Browser verified successful 11.9-second original alongside 5.2-second synthetic recording, and cancellation preserving prior waveforms. Fixture removed. Screenshot qa/streaming-waveform.jpg. Build and 25 automated checks passed (21 core/assessment plus 4 Sites). Exact user file and large-file stress memory not tested.

Recording association fix: explicit paused scrubs now select the corresponding cue (next cue in gaps; last cue at end), without seeking back during continuous playback. Browser verified paused End moved selection from group 1-3 to cue 8 at 33.65s. Capture callback uses session speed and clamped playback bounds; source playback takes session settings rather than current mutable settings. Source-then-recording comparison replays saved reference bounds/speed. Records display saved range and warn on edited timelines; existing recordings are preserved. Screenshot qa/recording-range-sync.jpg. No user recording audio was inspected, so exact existing take association cannot be established.

Source waveform time mapping fix: replaced receipt-time media.currentTime positioning and 2048-frame midpoint bins with audio-render-clock timestamped 128-frame packets, distributed by overlap across fixed bins and clipped to selected duration. Original samples are read at 1x; display coordinates stretch by captured practice speed, avoiding browser pitch-preserving time-stretch boundary contamination. Mid-play buffering rejects with an explicit retry message rather than drawing a misleading axis. Development harness creates a 6-second WAV: loud audio outside selected [2,4], a tone only at [2.5,3] inside. Browser passed at 1x (2s) and display 0.8x (2.5s), active bins 59-119 versus expected 60-119 and silent prefix/tail. This confirms approximate envelope alignment within one display bin, not sample-accurate/word-level synchronization. Screenshot qa/source-waveform-timing.jpg. Build, 23 core/assessment tests and 4 Sites checks pass. User's original encoding not tested. No test recordings saved by this harness.

2026-10-06: custom continuous cue-count option added; accepts positive safe integers, reused grouping identity/navigation/recording engine, restores non-preset values across reload, clips at last cue. Source capture freezes AudioContext while seeking/starting playback, anchors the render clock before resume so packets cannot be discarded ahead of the playing event. Browser known-tone tests at source start 0 and 2 seconds, display speeds 1x/0.8x: all first active bins 0, all initial 25 bins have expected tone, actual silence and middle/tail checks passed. Baseline WAV also passed; exact user's reported missing-onset encoding remains unverified. Synthetic harness does not save recordings. Custom 4-cue group UI verified 3-6; core test verifies custom group identity/tail. Evidence qa/custom-practice-range.jpg and qa/source-waveform-onset.jpg.

Manual listen-then-record: new persisted manual mode waits after each source playback for explicit start. Synthetic browser integration verified indefinite waiting with zero elapsed/zero records, explicit trigger producing 1.371s WAV, second repetition waiting again, cancellation retaining exactly one take without an empty second take. Synthetic diagnostic data cleaned. Production UI manual mode selected; proof qa/manual-recording-mode.jpg. Build and 28 existing checks passed; browser integration covers the new gate, no real microphone used.
