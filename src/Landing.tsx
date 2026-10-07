import { appUrl } from './appUrl.ts';
import { useState } from 'react';
import { ArrowRight, ArrowDown, GithubLogo, Video, Headphones, FileText } from '@phosphor-icons/react';
import './landing.css';

const repository = 'https://github.com/LeonWangXL/Shadowing';
const steps = [
  ['LISTEN', '先听原声', '理解语境和语调'],
  ['SHADOW', '模仿跟读', '大声朗读，练习停顿与重音'],
  ['COMPARE', '对比回听', '回听自己的录音与原声'],
  ['REPEAT', '重复练习', '按自己的节奏再练一遍'],
];

export function Landing() {
  const [speed, setSpeed] = useState('1'), [repeat, setRepeat] = useState(false);
  const [moreQuestions, setMoreQuestions] = useState(false);
  const [changedSettings, setChangedSettings] = useState(false);
  const start = changedSettings ? `${appUrl('practice/')}?speed=${speed}&repeat=${repeat}` : appUrl('practice/');
  return <div className="landing">
    <a className="landing-skip" href="#landing-main">跳到正文</a>
    <header className="landing-header landing-container">
      <a className="landing-logo" href={appUrl('')} aria-label="Shadowing 首页">Shadowing</a>
      <nav aria-label="首页导航"><a href="#how-it-works">练习方式</a><a href="#your-materials">你的素材</a><a href="#faq">常见问题</a><a href={repository} target="_blank" rel="noreferrer">GitHub</a></nav>
      <a className="landing-enter" href={start}>进入练习<ArrowRight size={18} /></a>
    </header>
    <main id="landing-main">
      <section className="landing-hero landing-container" aria-labelledby="hero-title">
        <p className="landing-eyebrow">YOUR PERSONAL SHADOWING STUDIO</p>
        <h1 id="hero-title">让英语，真正说出口。</h1>
        <p className="landing-lead">把喜欢的视频、音频和文章，变成每天的跟读练习。<br className="desktop-break" />听原声、练表达、回听对比，按自己的节奏进步。</p>
        <a className="landing-primary" href={start}>开始练习<ArrowRight size={21} /></a>
        <a className="landing-secondary" href="#how-it-works">了解练习方式<ArrowDown size={16} /></a>
        <a className="landing-preview" href={start} aria-label="查看真实练习界面并开始练习"><img src={appUrl('assets/practice-preview.png')} width="1440" height="970" alt="Shadowing 实际练习界面：左侧播放原声并显示当前句，右侧选择字幕，录音后回听对比。" fetchPriority="high" /><span className="landing-preview-caption">实际练习界面 · 合成音频示例与静态封面</span></a>
        <p className="landing-local-note">无需账号 · 素材与录音保存在当前浏览器</p>
      </section>
      <section className="landing-process landing-container" id="how-it-works" aria-labelledby="process-title">
        <h2 id="process-title">四步练习</h2>
        <ol>{steps.map(([name, title, text], index) => <li key={name}><span className="landing-step-number">{index + 1}</span><div><strong>{name}</strong><h3>{title}</h3><p>{text}</p></div>{index < steps.length - 1 && <ArrowRight className="landing-step-arrow" size={19} aria-hidden="true" />}</li>)}</ol>
      </section>
      <section className="landing-features landing-container" id="your-materials" aria-label="素材与练习节奏">
        <div className="landing-materials"><h2>用你的素材，练你的表达。</h2><p className="landing-section-lead">把你感兴趣的内容，变成专属的跟读练习。</p>
          <ul>{[
            { Icon: Video, title: '视频 + SRT', text: '上传本地视频文件与字幕，开始练习。' },
            { Icon: Headphones, title: '音频 + SRT', text: '支持常见音频格式，配合字幕练习。' },
            { Icon: FileText, title: '文章 → 音频 + SRT', text: '粘贴文章或导入 TXT，生成朗读音频与字幕。' },
          ].map(({ Icon, title, text }) => <li key={title}><span className="landing-feature-icon"><Icon size={28} weight="regular" /></span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ul>
          <p className="landing-material-note">文章语音生成需要联网；生成后可本地回放。</p>{import.meta.env.VITE_STATIC_HOST === 'true' && <p className="landing-material-note">当前在线版支持媒体导入、跟读录音与下载。文章转语音和 Azure 评测需使用本地完整版。</p>}
        </div>
        <div className="landing-rhythm"><h2>练习节奏，由你决定。</h2><p className="landing-section-lead">自由设置播放语速与循环，找到适合自己的节奏。</p>
          <div className="landing-settings"><div><label htmlFor="landing-speed">播放语速</label><div><select id="landing-speed" value={speed} onChange={event => { setSpeed(event.target.value); setChangedSettings(true); }}>{['0.6', '0.8', '1', '1.2'].map(value => <option key={value} value={value}>{Number(value).toFixed(1)}x</option>)}</select><p>从 0.6x 到 1.2x，按你的节奏练习。</p></div></div><div><span id="landing-repeat-label">循环播放</span><div><button className={`landing-switch ${repeat ? 'enabled' : ''}`} type="button" role="switch" aria-labelledby="landing-repeat-label" aria-checked={repeat} onClick={() => { setRepeat(value => !value); setChangedSettings(true); }}><span /></button><p>{repeat ? '已开启，进入练习后重复当前句子或句组。' : '开启后，当前句子或句组会重复播放。'}</p></div></div></div>
          <p className="landing-settings-note">选好节奏，点击“开始练习”即可应用。</p>
        </div>
      </section>
      <section className="landing-faq landing-container" id="faq" aria-labelledby="faq-title">
        <div className="landing-section-heading"><h2 id="faq-title">常见问题</h2><button type="button" onClick={() => setMoreQuestions(value => !value)} aria-expanded={moreQuestions} aria-controls="landing-more-faq">{moreQuestions ? '收起更多问题' : '查看更多问题'}<ArrowRight size={16} /></button></div>
        <div className="landing-faq-grid"><article><span className="landing-question">Q</span><div><h3>需要注册账号吗？</h3><p>无需账号，素材与录音保存在当前浏览器。</p></div></article><article><span className="landing-question">Q</span><div><h3>可以评估发音吗？</h3><p>可选连接 Azure Speech，英语录音评测限 30 秒。</p></div></article></div>
        <div id="landing-more-faq" className="landing-more-faq" hidden={!moreQuestions}><details><summary>录音会自动上传吗？</summary><p>默认保存在当前浏览器。只有主动发起发音评测，才会把所选录音和参考文本发送给 Azure Speech，可能产生服务费用。文章生成会通过 edge-tts 将文章发送给微软在线语音服务。</p></details><details><summary>可以连续练习或录更长的内容吗？</summary><p>可以选择连续句组、自定义句数，设置重复和自动进入下一组。也可以先听后手动开始录音。本地录音最长 5 分钟，云端发音评测限 30 秒。</p></details><details><summary>素材和录音可以下载吗？</summary><p>可以下载原媒体、保留的原字幕、编辑后的 SRT、原文章和练习录音。素材不设导入大小上限，实际保存受浏览器可用空间影响；请定期下载备份。</p></details></div>
      </section>
      <section className="landing-final landing-container"><h2>下一句，现在开始。</h2><a className="landing-primary" href={start}>开始练习<ArrowRight size={21} /></a></section>
    </main>
    <footer className="landing-footer landing-container"><div><a className="landing-logo" href={appUrl('')}>Shadowing</a><p>在真实的内容里，练出更自然的表达。</p></div><nav aria-label="页脚导航"><a href="#how-it-works">练习方式</a><a href="#your-materials">你的素材</a><a href="#faq">常见问题</a><a href={repository} target="_blank" rel="noreferrer"><GithubLogo size={17} />GitHub</a></nav></footer>
  </div>;
}
