import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceRecorderProps {
  patientId: string;
  onVoiceNoteAdded: (url: string) => void;
}

export function VoiceRecorder({ patientId, onVoiceNoteAdded }: VoiceRecorderProps) {
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
      toast.error("Не удалось получить доступ к микрофону");
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
      toast.success("Голосовая заметка добавлена");
      deleteRecording();
    } catch (error: any) {
      toast.error("Ошибка загрузки: " + error.message);
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
            <Button onClick={startRecording} variant="outline" className="border-slate-600">
              <Mic className="w-4 h-4 mr-2" />
              Записать голосовую заметку
            </Button>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-red-400">Идет запись...</span>
              </div>
              <Button onClick={stopRecording} variant="outline" className="border-slate-600">
                <Square className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <Button
              size="sm"
              variant="outline"
              onClick={isPlaying ? pauseAudio : playAudio}
              className="border-slate-600"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <span className="text-sm text-slate-400 flex-1">Голосовая заметка записана</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={deleteRecording}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={uploadRecording} disabled={uploading} className="w-full">
            {uploading ? "Загрузка..." : "Добавить в запись"}
          </Button>
        </div>
      )}
    </div>
  );
}
