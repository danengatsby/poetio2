Fișiere sintetice generate pentru teste: două secunde de ton și model geometric, fără conținut de utilizator. Comenzi de regenerare cu FFmpeg 8.0.1:

```sh
ffmpeg -v error -y -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 -c:a libmp3lame -threads 1 tests/fixtures/media/tone.mp3
ffmpeg -v error -y -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 -c:a aac -threads 1 tests/fixtures/media/tone.m4a
ffmpeg -v error -y -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 -c:a libopus -threads 1 tests/fixtures/media/tone.ogg
ffmpeg -v error -y -f lavfi -i testsrc2=size=160x90:rate=12:duration=2 -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 -c:v libx264 -pix_fmt yuv420p -c:a aac -threads 1 -movflags +faststart tests/fixtures/media/clip.mp4
ffmpeg -v error -y -f lavfi -i testsrc2=size=160x90:rate=12:duration=2 -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 -c:v libvpx-vp9 -pix_fmt yuv420p -c:a libopus -threads 1 -c:a libvorbis tests/fixtures/media/clip.webm
```
