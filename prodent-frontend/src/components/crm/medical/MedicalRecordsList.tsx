import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, FileText, Mic, Play, Pause } from "lucide-react";
import { useState, useRef } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MedicalRecord {
  id: string;
  visit_date: string;
  chief_complaint: string;
  examination: string | null;
  diagnosis: string;
  treatment_provided: string | null;
  recommendations: string | null;
  next_visit_date: string | null;
  voice_notes: string[] | null;
}

interface MedicalRecordsListProps {
  records: MedicalRecord[];
}

export function MedicalRecordsList({ records }: MedicalRecordsListProps) {
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleRecord = (id: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRecords(newExpanded);
  };

  const playVoiceNote = (url: string) => {
    if (playingAudio === url && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingAudio(url);

        audioRef.current.onended = () => {
          setPlayingAudio(null);
        };
      }
    }
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Медицинские записи отсутствуют</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} className="hidden" />

      {records.map((record) => (
        <Collapsible
          key={record.id}
          open={expandedRecords.has(record.id)}
          onOpenChange={() => toggleRecord(record.id)}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CollapsibleTrigger asChild>
              <CardContent className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-white font-medium">
                        {format(parseISO(record.visit_date), "d MMMM yyyy, HH:mm", { locale: ru })}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 mb-2">
                      <span className="font-semibold text-[#00C6BB]">Диагноз:</span> {record.diagnosis}
                    </div>
                    <div className="text-sm text-slate-400 line-clamp-2">
                      <span className="font-medium">Жалобы:</span> {record.chief_complaint}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {record.voice_notes && record.voice_notes.length > 0 && (
                      <Badge variant="outline" className="border-slate-600">
                        <Mic className="w-3 h-3 mr-1" />
                        {record.voice_notes.length}
                      </Badge>
                    )}
                    {record.next_visit_date && (
                      <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                        След. визит
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 px-4 space-y-4 border-t border-slate-700">
                {record.examination && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">
                      Объективный осмотр:
                    </h4>
                    <p className="text-sm text-slate-400">{record.examination}</p>
                  </div>
                )}

                {record.treatment_provided && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">
                      Проведенное лечение:
                    </h4>
                    <p className="text-sm text-slate-400">{record.treatment_provided}</p>
                  </div>
                )}

                {record.recommendations && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Рекомендации:</h4>
                    <p className="text-sm text-slate-400">{record.recommendations}</p>
                  </div>
                )}

                {record.next_visit_date && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Следующий визит:</h4>
                    <p className="text-sm text-blue-400">
                      {format(parseISO(record.next_visit_date), "d MMMM yyyy", { locale: ru })}
                    </p>
                  </div>
                )}

                {record.voice_notes && record.voice_notes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      Голосовые заметки:
                    </h4>
                    <div className="space-y-2">
                      {record.voice_notes.map((note, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600"
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => playVoiceNote(note)}
                            className="hover:bg-slate-600"
                          >
                            {playingAudio === note ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <span className="text-sm text-slate-400">Заметка {index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
