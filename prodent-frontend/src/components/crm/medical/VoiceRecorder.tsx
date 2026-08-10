import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { a11yLabel } from "@/lib/a11y-labels";

interface VoiceRecorderProps {
  patientId: string;
  onVoiceNoteAdded: (url: string) => void;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function VoiceRecorder({ patientId, onVoiceNoteAdded }: VoiceRecorderProps) {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error(t('crmVoiceRecorder.micError'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = () => {
    if (audioBlob && audioRef.current) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);

      audioRef.current.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioRef.current) {
      audioRef.current.src = "";
    }
  };

  const uploadRecording = async () => {
    if (!audioBlob) return;

    setUploading(true);
    try {
      const fileName = `${patientId}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("voice-notes")
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("voice-notes").getPublicUrl(fileName);

      onVoiceNoteAdded(urlData.publicUrl);
      toast.success(t('crmVoiceRecorder.noteAdded'));
      deleteRecording();
    } catch (error: unknown) {
      toast.error(`${t('crmVoiceRecorder.uploadError')}: ${getErrorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <audio ref={audioRef} className="hidden" />

      {!audioBlob ? (
        <div className="flex gap-2">
          {!isRecording ? (
            <Button onClick={startRecording} variant="outline" className="border-border">
              <Mic className="w-4 h-4 mr-2" />
              {t('crmVoiceRecorder.recordNote')}
            </Button>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-status-danger/10 border border-status-danger/30 rounded-lg">
                <div className="w-2 h-2 bg-status-danger rounded-full animate-pulse" />
                <span className="text-sm text-status-danger">{t('crmVoiceRecorder.recording')}</span>
              </div>
              <Button onClick={stopRecording} variant="outline" className="border-border" aria-label={a11yLabel("stop")}>
                <Square className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <Button
              size="sm"
              variant="outline"
              onClick={isPlaying ? pauseAudio : playAudio}
              className="border-border"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <span className="text-sm text-muted-foreground flex-1">{t('crmVoiceRecorder.noteRecorded')}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={deleteRecording}
              className="text-status-danger hover:text-status-danger/80"
             aria-label={a11yLabel("delete")}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={uploadRecording} disabled={uploading} className="w-full">
            {uploading ? t('crmVoiceRecorder.uploading') : t('crmVoiceRecorder.addToRecord')}
          </Button>
        </div>
      )}
    </div>
  );
}
