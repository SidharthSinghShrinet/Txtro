import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatAudioDuration } from '../../hooks/useAudioRecorder';

/**
 * Deterministically generates a natural-looking waveform profile (28 bars)
 * based on the audio file's name or URL.
 */
const getWaveformBars = (seed = '') => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars = [];
  for (let i = 0; i < 28; i++) {
    // Natural voice pattern with speech peaks and gentle valleys
    const val = Math.abs(Math.sin(hash + i * 1.618) * 72) + 22;
    bars.push(Math.round(val));
  }
  return bars;
};

const VoiceNotePlayer = ({
  fileUrl,
  fileName = 'voice-note.webm',
  duration = 0,
  waveform: realWaveform = [],
  isOutgoing = false,
}) => {
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Use real recorded speech peaks if available, fallback to deterministic hash
  const activeWaveform = useMemo(() => {
    if (Array.isArray(realWaveform) && realWaveform.length > 0) {
      return realWaveform;
    }
    return getWaveformBars(fileName || fileUrl);
  }, [realWaveform, fileName, fileUrl]);

  // Sync duration when passed from attachment metadata
  useEffect(() => {
    if (duration > 0 && !audioDuration) {
      setAudioDuration(duration);
    }
  }, [duration, audioDuration]);

  // Global Audio Singleton: Pause if another audio player starts playing
  useEffect(() => {
    const handleOtherAudioPlay = (e) => {
      if (e.detail?.activeUrl !== fileUrl && isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener('txtro:audio-play', handleOtherAudioPlay);
    return () => {
      window.removeEventListener('txtro:audio-play', handleOtherAudioPlay);
    };
  }, [fileUrl, isPlaying]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Audio event listeners
  const handleLoadedMetadata = () => {
    if (audioRef.current?.duration && isFinite(audioRef.current.duration)) {
      setAudioDuration(Math.round(audioRef.current.duration));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Broadcast to silence all other audio players across the chat stream
      window.dispatchEvent(
        new CustomEvent('txtro:audio-play', { detail: { activeUrl: fileUrl } })
      );

      audioRef.current.play().catch((err) => {
        console.error('Audio playback failed:', err);
      });
      setIsPlaying(true);
    }
  };

  const togglePlaybackRate = () => {
    if (!audioRef.current) return;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  // Fluid pointer drag-to-seek scrubbing (Mouse & Touch unified)
  const isDraggingRef = useRef(false);

  const calculateSeek = (clientX) => {
    if (!progressBarRef.current || !audioRef.current || !audioDuration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * audioDuration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    calculateSeek(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    calculateSeek(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { }
    }
  };

  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1 px-1 select-none min-w-[240px] sm:min-w-[270px]">
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={fileUrl}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      {/* Play / Pause Round Button */}
      <button
        type="button"
        onClick={togglePlayPause}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${isOutgoing
            ? 'bg-white text-indigo-600 hover:bg-slate-100 shadow-indigo-950/20'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/25'
          }`}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause size={18} className="fill-current" />
        ) : (
          <Play size={18} className="fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform Scrubber & Timer Track */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        {/* Interactive Waveform Bar Scrubber */}
        <div
          ref={progressBarRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex items-center gap-[3px] h-6 cursor-pointer py-1 touch-none select-none"
          title="Drag or click to seek"
        >
          {activeWaveform.map((heightPercent, idx) => {
            const barRatio = (idx / (activeWaveform.length - 1)) * 100;
            const isPlayed = barRatio <= progressPercent;

            return (
              <span
                key={idx}
                style={{ height: `${Math.max(5, (heightPercent / 100) * 22)}px` }}
                className={`flex-1 min-w-[2px] rounded-full transition-colors duration-100 ${isOutgoing
                    ? isPlayed
                      ? 'bg-white'
                      : 'bg-white/35 hover:bg-white/50'
                    : isPlayed
                      ? 'bg-indigo-600 dark:bg-indigo-400'
                      : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                  }`}
              />
            );
          })}
        </div>

        {/* Bottom Time & Metadata Row */}
        <div className="flex items-center justify-between text-[11px] font-mono leading-none">
          {/* Formatted time (elapsed if playing, total duration if stopped) */}
          <span
            className={
              isOutgoing
                ? 'text-indigo-100 font-semibold'
                : 'text-slate-500 dark:text-slate-400 font-semibold'
            }
          >
            {isPlaying
              ? formatAudioDuration(currentTime)
              : formatAudioDuration(audioDuration || duration)}
          </span>

          {/* 1x / 1.5x / 2x Speed Multiplier Toggle */}
          <button
            type="button"
            onClick={togglePlaybackRate}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${isOutgoing
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/60'
              }`}
            title="Change playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceNotePlayer;

