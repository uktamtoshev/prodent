import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface DoctorPartnershipAgreementProps {
  accepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
}

export function DoctorPartnershipAgreement({ accepted, onAcceptChange }: DoctorPartnershipAgreementProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1 space-y-2">
          <h4 className="font-medium">Партнёрское соглашение</h4>
          <p className="text-sm text-muted-foreground">
            Для регистрации на платформе PRODENT необходимо ознакомиться и принять условия партнёрского соглашения.
          </p>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Читать соглашение
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  Партнёрское соглашение о подключении врача к цифровой платформе PRODENT
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">1. СТОРОНЫ СОГЛАШЕНИЯ</h3>
                    <p><strong>1.1. Оператор платформы:</strong><br />
                      ООО «PRODENT TECHNOLOGIES»<br />
                      (бренд / платформа PRODENT)<br />
                      именуемое далее «Платформа»,
                    </p>
                    <p><strong>1.2. Врач-партнёр:</strong><br />
                      Физическое лицо, осуществляющее медицинскую деятельность, именуемый далее «Врач»,
                    </p>
                    <p>совместно — «Стороны».</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">2. ЮРИДИЧЕСКАЯ ПРИРОДА СОГЛАШЕНИЯ</h3>
                    <p><strong>2.1.</strong> Настоящее Соглашение является соглашением о доступе и использовании IT-платформы.</p>
                    <p><strong>2.2.</strong> Соглашение НЕ является:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>трудовым договором;</li>
                      <li>договором оказания медицинских услуг;</li>
                      <li>агентским или комиссионным договором;</li>
                      <li>договором о совместной деятельности.</li>
                    </ul>
                    <p><strong>2.3.</strong> Платформа не участвует в финансовых расчётах между Врачом и Пациентами.</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">3. ПРЕДМЕТ СОГЛАШЕНИЯ</h3>
                    <p><strong>3.1.</strong> Платформа предоставляет Врачу безвозмездный доступ к цифровой платформе PRODENT, включающей:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>профиль врача;</li>
                      <li>систему записи пациентов;</li>
                      <li>электронную медицинскую карту (EMR);</li>
                      <li>коммуникационные инструменты;</li>
                      <li>аналитические и организационные функции.</li>
                    </ul>
                    <p><strong>3.2.</strong> Врач использует платформу исключительно как IT-инструмент для организации своей профессиональной деятельности.</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">4. СТАТУС ВРАЧА</h3>
                    <p><strong>4.1.</strong> Врач:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>осуществляет медицинскую деятельность самостоятельно;</li>
                      <li>действует от собственного имени;</li>
                      <li>несёт полную ответственность за оказываемые медицинские услуги.</li>
                    </ul>
                    <p><strong>4.2.</strong> Врач подтверждает наличие:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>профильного образования;</li>
                      <li>действующих сертификатов / лицензий (при необходимости);</li>
                      <li>законного права на медицинскую практику в Республике Узбекистан.</li>
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">5. РОЛЬ ПЛАТФОРМЫ</h3>
                    <p><strong>5.1.</strong> Платформа:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>не оказывает медицинские услуги;</li>
                      <li>не вмешивается в лечебный процесс;</li>
                      <li>не даёт медицинских рекомендаций;</li>
                      <li>не влияет на решения врача.</li>
                    </ul>
                    <p><strong>5.2.</strong> Платформа выполняет исключительно технологическую функцию.</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">6. ФИНАНСОВЫЕ УСЛОВИЯ</h3>
                    <p><strong>6.1.</strong> Использование платформы PRODENT для Врача является бесплатным.</p>
                    <p><strong>6.2.</strong> Платформа:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>не взимает комиссий;</li>
                      <li>не удерживает проценты;</li>
                      <li>не обрабатывает платежи пациентов;</li>
                      <li>не участвует в расчётах между Врачом и Пациентом.</li>
                    </ul>
                    <p><strong>6.3.</strong> Все финансовые отношения осуществляются напрямую между Врачом и Пациентом вне платформы.</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">7. ОБЯЗАННОСТИ ВРАЧА</h3>
                    <p>Врач обязуется:</p>
                    <p><strong>7.1.</strong> Использовать платформу добросовестно и по назначению.</p>
                    <p><strong>7.2.</strong> Соблюдать:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>законодательство Республики Узбекистан;</li>
                      <li>врачебную тайну;</li>
                      <li>нормы профессиональной этики.</li>
                    </ul>
                    <p><strong>7.3.</strong> Обеспечивать достоверность информации в своём профиле.</p>
                    <p><strong>7.4.</strong> Не использовать платформу для:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>незаконной деятельности;</li>
                      <li>распространения недостоверной информации;</li>
                      <li>дискредитации Платформы.</li>
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">8. ПЕРСОНАЛЬНЫЕ ДАННЫЕ</h3>
                    <p><strong>8.1.</strong> Врач получает доступ к персональным данным пациентов исключительно в целях лечения.</p>
                    <p><strong>8.2.</strong> Запрещается:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>копирование базы пациентов;</li>
                      <li>передача данных третьим лицам;</li>
                      <li>использование данных вне PRODENT.</li>
                    </ul>
                    <p><strong>8.3.</strong> Хранение и обработка данных осуществляется в соответствии с Законом Республики Узбекистан «О персональных данных», с размещением серверов на территории Республики Узбекистан.</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">9. ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ</h3>
                    <p><strong>9.1.</strong> Все элементы платформы PRODENT (код, дизайн, архитектура) принадлежат Платформе.</p>
                    <p><strong>9.2.</strong> Врач получает неисключительное право использования платформы на срок действия Соглашения.</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">10. ОТВЕТСТВЕННОСТЬ</h3>
                    <p><strong>10.1.</strong> Врач несёт полную ответственность за:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>качество лечения;</li>
                      <li>последствия медицинских вмешательств;</li>
                      <li>жалобы и претензии пациентов.</li>
                    </ul>
                    <p><strong>10.2.</strong> Платформа не несёт ответственности за:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>медицинские результаты;</li>
                      <li>действия или бездействие Врача.</li>
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">11. ПРИОСТАНОВЛЕНИЕ ДОСТУПА</h3>
                    <p><strong>11.1.</strong> Платформа вправе временно или постоянно ограничить доступ Врача при:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>нарушении условий Соглашения;</li>
                      <li>угрозе безопасности данных;</li>
                      <li>нарушении законодательства Республики Узбекистан.</li>
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">12. СРОК И РАСТОРЖЕНИЕ</h3>
                    <p><strong>12.1.</strong> Соглашение вступает в силу с момента акцепта (онлайн-регистрация).</p>
                    <p><strong>12.2.</strong> Может быть расторгнуто:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>по инициативе любой стороны;</li>
                      <li>в одностороннем порядке без объяснения причин.</li>
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">13. РАЗРЕШЕНИЕ СПОРОВ</h3>
                    <p><strong>13.1.</strong> Все споры рассматриваются в соответствии с законодательством Республики Узбекистан в судах Республики Узбекистан.</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">14. АКЦЕПТ</h3>
                    <p><strong>14.1.</strong> Регистрация Врача в системе PRODENT и подтверждение согласия с условиями настоящего Соглашения признаётся полноценным юридическим акцептом.</p>
                  </section>
                </div>
              </ScrollArea>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setOpen(false)}>Закрыть</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-start gap-3 pl-8">
        <Checkbox
          id="agreement-accept"
          checked={accepted}
          onCheckedChange={(checked) => onAcceptChange(checked === true)}
        />
        <Label htmlFor="agreement-accept" className="text-sm leading-relaxed cursor-pointer">
          Я ознакомился с условиями Партнёрского соглашения и принимаю их в полном объёме. Регистрация признаётся полноценным юридическим акцептом.
        </Label>
      </div>
    </div>
  );
}
