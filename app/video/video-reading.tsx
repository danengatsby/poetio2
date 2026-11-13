'use client';
import type { Video } from '@/lib/video-types';
import type { PoemLanguage } from '@/lib/poem-types';
import VideoPlayer from './video-player';
export default function VideoReading({ video, src, poster, language, children, mediaStatus = false }: { video: Pick<Video, 'title' | 'author' | 'description'>; src?: string; poster?: string; language: PoemLanguage; children?: React.ReactNode; mediaStatus?: boolean }) {
  return <article><p className="eyebrow">Video</p><h1>{video.title || (language === 'ro' ? 'Fără titlu' : 'Untitled')}</h1>{video.author && <p className="reader-author">{video.author}</p>}{children}{src ? <VideoPlayer key={src} src={src} poster={poster} title={video.title} language={language} showStatus={mediaStatus} /> : <p role="status">{language === 'ro' ? 'Alege un fișier video pentru a verifica redarea.' : 'Choose a video to check playback.'}</p>}<p className="video-description">{video.description}</p></article>;
}
