'use client';
import type { Video } from '@/lib/video-types';
import type { SiteLanguage } from '@/lib/poem-types';
import VideoPlayer from './video-player';
import { pick } from '@/lib/site-language';
export default function VideoReading({
  video,
  src,
  poster,
  language,
  children,
  mediaStatus = false,
}: {
  video: Pick<Video, 'title' | 'author' | 'description' | 'id' | 'subtitle_text' | 'subtitle_language'>;
  src?: string;
  poster?: string;
  language: SiteLanguage;
  children?: React.ReactNode;
  mediaStatus?: boolean;
}) {
  return (
    <article>
      <p className="eyebrow">{pick(language, 'Video', 'Video', 'Vidéo', 'Video', 'Vídeo', 'Video')}</p>
      <h1>
        {video.title ||
          pick(language, 'Fără titlu', 'Untitled', 'Sans titre', 'Ohne Titel', 'Sin título', 'Senza titolo')}
      </h1>
      {video.author && <p className="reader-author">{video.author}</p>}
      {children}
      {src ? (
        <VideoPlayer
          key={src}
          src={src}
          subtitleSrc={!mediaStatus && video.subtitle_text ? `/api/videos/${video.id}/subtitles` : undefined}
          subtitleLanguage={video.subtitle_language || 'ro'}
          previewText={mediaStatus ? video.subtitle_text : undefined}
          poster={poster}
          title={video.title}
          language={language}
          showStatus={mediaStatus}
        />
      ) : (
        <p role="status">
          {pick(
            language,
            'Alege un fișier video pentru a verifica redarea.',
            'Choose a video to check playback.',
            'Choisissez une vidéo pour vérifier la lecture.',
            'Wählen Sie ein Video, um die Wiedergabe zu prüfen.',
            'Elige un vídeo para comprobar la reproducción.',
            'Scegli un video per controllare la riproduzione.',
          )}
        </p>
      )}
      <p className="video-description">{video.description}</p>
    </article>
  );
}
