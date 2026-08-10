import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface DoctorPartnershipAgreementProps {
  accepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
}

export function DoctorPartnershipAgreement({ accepted, onAcceptChange }: DoctorPartnershipAgreementProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1 space-y-2">
          <h4 className="font-medium">{t("agreement.title")}</h4>
          <p className="text-sm text-muted-foreground">
            {t("agreement.summary")}
          </p>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {t("agreement.read")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {t("agreement.fullTitle")}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s1_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s1_p1") }} />
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s1_p2") }} />
                    <p>{t("agreement.s1_p3")}</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s2_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s2_p1") }} />
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s2_p2") }} />
                    <ul className="list-disc ml-6 space-y-1">
                      <li>{t("agreement.s2_l1")}</li>
                      <li>{t("agreement.s2_l2")}</li>
                      <li>{t("agreement.s2_l3")}</li>
                      <li>{t("agreement.s2_l4")}</li>
                    </ul>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s2_p3") }} />
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s3_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s3_p1") }} />
                    <ul className="list-disc ml-6 space-y-1">
                      <li>{t("agreement.s3_l1")}</li>
                      <li>{t("agreement.s3_l2")}</li>
                      <li>{t("agreement.s3_l3")}</li>
                      <li>{t("agreement.s3_l4")}</li>
                      <li>{t("agreement.s3_l5")}</li>
                    </ul>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s3_p2") }} />
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s4_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s4_p1") }} />
                    <ul className="list-disc ml-6 space-y-1">
                      <li>{t("agreement.s4_l1")}</li>
                      <li>{t("agreement.s4_l2")}</li>
                      <li>{t("agreement.s4_l3")}</li>
                    </ul>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s4_p2") }} />
                    <ul className="list-disc ml-6 space-y-1">
                      <li>{t("agreement.s4_l4")}</li>
                      <li>{t("agreement.s4_l5")}</li>
                      <li>{t("agreement.s4_l6")}</li>
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s5_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s5_p1") }} />
                    <ul className="list-disc ml-6 space-y-1">
                      <li>{t("agreement.s5_l1")}</li>
                      <li>{t("agreement.s5_l2")}</li>
                      <li>{t("agreement.s5_l3")}</li>
                      <li>{t("agreement.s5_l4")}</li>
                    </ul>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s5_p2") }} />
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s6_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s6_p1") }} />
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s6_p2") }} />
                    <ul className="list-disc ml-6 space-y-1">
                      <li>{t("agreement.s6_l1")}</li>
                      <li>{t("agreement.s6_l2")}</li>
                      <li>{t("agreement.s6_l3")}</li>
                      <li>{t("agreement.s6_l4")}</li>
                    </ul>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s6_p3") }} />
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s12_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s12_p1") }} />
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s12_p2") }} />
                    <ul className="list-disc ml-6 space-y-1">
                      <li>{t("agreement.s12_l1")}</li>
                      <li>{t("agreement.s12_l2")}</li>
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s13_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s13_p1") }} />
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">{t("agreement.s14_h")}</h3>
                    <p dangerouslySetInnerHTML={{ __html: t("agreement.s14_p1") }} />
                  </section>
                </div>
              </ScrollArea>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setOpen(false)}>{t("agreement.close")}</Button>
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
          {t("agreement.acceptLabel")}
        </Label>
      </div>
    </div>
  );
}
